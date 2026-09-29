import io,uuid,base64
from datetime import datetime,timezone
from fastapi import APIRouter,Depends,HTTPException,UploadFile,File,Response
from sqlalchemy.orm import Session,joinedload
from sqlalchemy import or_
from app.db.session import get_db
from app.models.order import Order,OrderItem
from app.models.customer import Customer
from app.models.product import Product
from app.models.notification import Notification
from app.models.audit import AuditLog
from app.schemas.order import OrderCreate,OrderUpdate,ItemCreate,ItemStatusUpdate,OrderOut
from app.schemas.audit import AuditOut
from app.core.security import current_user
from app.services.storage import upload,presigned,safe_filename
from app.services.audit import record_audit
from app.services.inventory import locked_product,reserve_product,release_product
from app.tasks.celery_app import send_whatsapp_task as _send_whatsapp_task
from typing import Any
# celery's decorator typing doesn't expose .delay to type checkers; the runtime
# object is a Task proxy, so the queued calls below are safe.
send_whatsapp_task:Any=_send_whatsapp_task
import qrcode
router=APIRouter(prefix='/orders',tags=['orders'])
ITEM_STATUSES={'ORDER_CREATED','SENT_TO_WORKSHOP','IN_PROGRESS','QUALITY_CHECK','REWORK_REQUIRED','READY','DELIVERED','ON_HOLD','CANCELLED'}
ORDER_STATUSES={'OPEN','IN_PROGRESS','PARTIALLY_READY','READY','DELIVERED','CANCELLED'}
# Terminal states accept no further transitions; non-terminal states may move
# forward along the lifecycle or to CANCELLED.
ORDER_TRANSITIONS={
    'OPEN':{'IN_PROGRESS','READY','DELIVERED','CANCELLED'},
    'IN_PROGRESS':{'PARTIALLY_READY','READY','DELIVERED','CANCELLED'},
    'PARTIALLY_READY':{'READY','IN_PROGRESS','DELIVERED','CANCELLED'},
    'READY':{'DELIVERED','IN_PROGRESS','PARTIALLY_READY','CANCELLED'},
    'DELIVERED':set(),
    'CANCELLED':set(),
}
ITEM_TRANSITIONS={
    'ORDER_CREATED':{'SENT_TO_WORKSHOP','IN_PROGRESS','ON_HOLD','CANCELLED'},
    'SENT_TO_WORKSHOP':{'IN_PROGRESS','QUALITY_CHECK','ON_HOLD','CANCELLED'},
    'IN_PROGRESS':{'QUALITY_CHECK','READY','REWORK_REQUIRED','ON_HOLD','CANCELLED'},
    'QUALITY_CHECK':{'READY','REWORK_REQUIRED','IN_PROGRESS'},
    'REWORK_REQUIRED':{'IN_PROGRESS','ON_HOLD','CANCELLED'},
    'READY':{'DELIVERED','QUALITY_CHECK','ON_HOLD'},
    'ON_HOLD':{'IN_PROGRESS','CANCELLED'},
    'DELIVERED':set(),
    'CANCELLED':set(),
}
def recompute_order_status(order:Order):
    items=order.items
    if not items: return 'OPEN'
    if all(x.status=='DELIVERED' for x in items): return 'DELIVERED'
    if all(x.status in {'READY','DELIVERED'} for x in items): return 'READY'
    if all(x.status in {'DELIVERED','CANCELLED'} for x in items): return 'DELIVERED' if any(x.status=='DELIVERED' for x in items) else 'CANCELLED'
    return 'PARTIALLY_READY' if any(x.status in {'READY','DELIVERED'} for x in items) else 'IN_PROGRESS'
def load_order(db:Session,order_id:int)->Order|None:
    return db.query(Order).options(joinedload(Order.items),joinedload(Order.customer)).filter(Order.id==order_id).first()
def maybe_queue_ready_notification(db:Session,item:OrderItem):
    # Idempotent: only queue when the customer opted in and no live
    # notification exists for this item already.
    if db.query(Notification).filter(Notification.order_item_id==item.id,Notification.status.in_({'QUEUED','SENT'})).first(): return
    customer=db.get(Customer,item.order.customer_id)
    if not customer or not customer.whatsapp_opt_in: return
    n=Notification(customer_id=customer.id,order_id=item.order_id,order_item_id=item.id,channel='WHATSAPP',type='ORDER_READY',status='QUEUED')
    db.add(n); db.flush(); send_whatsapp_task.delay(n.id)
@router.get('',response_model=list[OrderOut],summary='List orders with search (order number/customer/phone), status and date filters, sorting and pagination')
def list_orders(response:Response,status:str|None=None,customer_id:int|None=None,q:str|None=None,created_from:str|None=None,created_to:str|None=None,expected_from:str|None=None,expected_to:str|None=None,sort:str='id_desc',skip:int=0,limit:int=50,db:Session=Depends(get_db),_=Depends(current_user)):
    query=db.query(Order).join(Customer,Order.customer_id==Customer.id).options(joinedload(Order.items),joinedload(Order.customer))
    if status: query=query.filter(Order.status==status.upper())
    if customer_id: query=query.filter(Order.customer_id==customer_id)
    if q: query=query.filter(or_(Order.order_number.ilike(f'%{q}%'),Customer.name.ilike(f'%{q}%'),Customer.phone.ilike(f'%{q}%')))
    try:
        if created_from: query=query.filter(Order.created_at>=datetime.fromisoformat(created_from))
        if created_to: query=query.filter(Order.created_at<=datetime.fromisoformat(created_to))
        if expected_from: query=query.filter(Order.expected_delivery_date>=datetime.fromisoformat(expected_from).date())
        if expected_to: query=query.filter(Order.expected_delivery_date<=datetime.fromisoformat(expected_to).date())
    except ValueError: raise HTTPException(400,'Invalid date filter, use ISO format YYYY-MM-DD')
    order_map={'id_desc':Order.id.desc(),'id_asc':Order.id.asc(),'created_desc':Order.created_at.desc(),'created_asc':Order.created_at.asc()}
    query=query.order_by(order_map.get(sort,Order.id.desc()))
    total=query.count()
    response.headers['X-Total-Count']=str(total)
    return query.offset(skip).limit(min(limit,200)).all()
@router.post('',response_model=OrderOut,summary='Create an order with optional jewellery items (reserves stock in one transaction)')
def create_order(data:OrderCreate,db:Session=Depends(get_db),_=Depends(current_user)):
    if not db.get(Customer,data.customer_id): raise HTTPException(404,'Customer not found')
    o=Order(order_number=f"ANJ-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}",customer_id=data.customer_id,expected_delivery_date=data.expected_delivery_date,notes=data.notes,status='OPEN')
    db.add(o); db.flush()
    for payload in data.items:
        item=OrderItem(order_id=o.id,item_code=f"{o.order_number}-ITEM-{uuid.uuid4().hex[:5].upper()}",item_type=payload.item_type,description=payload.description,quantity=payload.quantity,expected_date=payload.expected_date,estimated_value=payload.estimated_value,workshop_notes=payload.workshop_notes,status='ORDER_CREATED')
        if payload.product_id:
            p=locked_product(db,payload.product_id)
            if not p: raise HTTPException(404,f'Product {payload.product_id} not found')
            reserve_product(p,payload.quantity)
            item.product_id=p.id
        db.add(item)
    db.flush()
    o.status=recompute_order_status(o)
    record_audit(db,'order_created','order',o.id,user_id=_.id,order_id=o.id,meta={'order_number':o.order_number,'items':len(data.items)})
    db.commit()
    return load_order(db,o.id)
@router.get('/{order_id}',response_model=OrderOut,summary='Get a single order with customer and items')
def get_order(order_id:int,db:Session=Depends(get_db),_=Depends(current_user)):
    o=load_order(db,order_id)
    if not o: raise HTTPException(404,'Order not found')
    return o
@router.get('/{order_id}/timeline',response_model=list[AuditOut],summary='Audit-based status timeline for an order and its items')
def order_timeline(order_id:int,db:Session=Depends(get_db),_=Depends(current_user)):
    if not load_order(db,order_id): raise HTTPException(404,'Order not found')
    return db.query(AuditLog).filter(AuditLog.order_id==order_id).order_by(AuditLog.created_at.asc(),AuditLog.id.asc()).limit(200).all()
@router.patch('/{order_id}',response_model=OrderOut,summary='Update an order (status transitions are validated)')
def update_order(order_id:int,data:OrderUpdate,db:Session=Depends(get_db),_=Depends(current_user)):
    o=load_order(db,order_id)
    if not o: raise HTTPException(404,'Order not found')
    update=data.model_dump(exclude_unset=True)
    if 'status' in update:
        target=update.pop('status')
        if target not in ORDER_STATUSES: raise HTTPException(400,'Invalid status')
        if target not in ORDER_TRANSITIONS[o.status]: raise HTTPException(400,f'Invalid status transition from {o.status} to {target}')
        record_audit(db,'order_status_changed','order',o.id,user_id=_.id,order_id=o.id,meta={'from':o.status,'to':target})
        o.status=target
    for k,v in update.items(): setattr(o,k,v)
    if update: record_audit(db,'order_updated','order',o.id,user_id=_.id,order_id=o.id,meta={'fields':list(update.keys())})
    db.commit(); db.refresh(o); return load_order(db,order_id)
@router.delete('/{order_id}',summary='Delete an order and release any reservations')
def delete_order(order_id:int,db:Session=Depends(get_db),_=Depends(current_user)):
    o=load_order(db,order_id)
    if not o: raise HTTPException(404,'Order not found')
    for item in o.items:
        if item.product_id and item.status not in {'DELIVERED','CANCELLED'}:
            p=db.get(Product,item.product_id)
            if p: release_product(p,item.quantity)
    record_audit(db,'order_deleted','order',o.id,user_id=_.id,order_id=None,meta={'order_number':o.order_number})
    db.delete(o); db.commit()
    return {'id':order_id,'deleted':True}
@router.post('/{order_id}/items',response_model=OrderOut,summary='Add a jewellery item to an order (reserves inventory stock)')
def add_item(order_id:int,data:ItemCreate,db:Session=Depends(get_db),_=Depends(current_user)):
    o=load_order(db,order_id)
    if not o: raise HTTPException(404,'Order not found')
    item=OrderItem(order_id=order_id,item_code=f"{o.order_number}-ITEM-{uuid.uuid4().hex[:5].upper()}",item_type=data.item_type,description=data.description,quantity=data.quantity,expected_date=data.expected_date,estimated_value=data.estimated_value,workshop_notes=data.workshop_notes,status='ORDER_CREATED')
    if data.product_id:
        p=locked_product(db,data.product_id)
        if not p: raise HTTPException(404,'Product not found')
        reserve_product(p,data.quantity)
        item.product_id=p.id
    db.add(item); db.flush()
    db.expire(o,['items'])
    o.status=recompute_order_status(o)
    record_audit(db,'item_created','order_item',item.id,user_id=_.id,order_id=order_id,meta={'item_type':data.item_type,'quantity':data.quantity,'product_id':data.product_id})
    db.commit()
    return load_order(db,order_id)
@router.patch('/items/{item_id}',response_model=OrderOut,summary='Update a jewellery item (handles reservation changes)')
def update_item(item_id:int,data:ItemCreate,db:Session=Depends(get_db),_=Depends(current_user)):
    item=db.get(OrderItem,item_id)
    if not item: raise HTTPException(404,'Item not found')
    item.item_type=data.item_type; item.description=data.description; item.expected_date=data.expected_date; item.estimated_value=data.estimated_value; item.workshop_notes=data.workshop_notes
    if data.product_id!=item.product_id:
        if data.product_id and not db.get(Product,data.product_id): raise HTTPException(404,'Product not found')
        if item.product_id and item.status not in {'DELIVERED','CANCELLED'}:
            p=locked_product(db,item.product_id)
            if p: release_product(p,item.quantity)
        item.product_id=data.product_id
        if data.product_id:
            p=locked_product(db,data.product_id)
            if not p: raise HTTPException(404,'Product not found')
            reserve_product(p,data.quantity)
    item.quantity=data.quantity
    item.order.status=recompute_order_status(item.order)
    record_audit(db,'item_updated','order_item',item.id,user_id=_.id,order_id=item.order_id,meta={'item_type':data.item_type,'quantity':data.quantity})
    db.commit()
    return load_order(db,item.order_id)
@router.delete('/items/{item_id}',summary='Delete an order item and release its reservation')
def delete_item(item_id:int,db:Session=Depends(get_db),_=Depends(current_user)):
    item=db.get(OrderItem,item_id)
    if not item: raise HTTPException(404,'Item not found')
    order_id=item.order_id
    if item.product_id and item.status not in {'DELIVERED','CANCELLED'}:
        p=db.get(Product,item.product_id)
        if p: release_product(p,item.quantity)
    record_audit(db,'item_deleted','order_item',item_id,user_id=_.id,order_id=order_id,meta={'item_code':item.item_code})
    db.delete(item); db.commit()
    o=load_order(db,order_id)
    if o:
        o.status=recompute_order_status(o); db.commit()
    return {'id':item_id,'deleted':True}
@router.patch('/items/{item_id}/status',response_model=OrderOut,summary='Update an item status (validated transitions; delivery consumes reserved stock)')
def update_status(item_id:int,data:ItemStatusUpdate,db:Session=Depends(get_db),_=Depends(current_user)):
    item=db.get(OrderItem,item_id)
    if not item: raise HTTPException(404,'Item not found')
    if data.status not in ITEM_STATUSES: raise HTTPException(400,'Invalid status')
    if data.status not in ITEM_TRANSITIONS[item.status]: raise HTTPException(400,f'Invalid status transition from {item.status} to {data.status}')
    previous=item.status
    item.status=data.status; item.workshop_notes=data.workshop_notes if data.workshop_notes is not None else item.workshop_notes
    if data.status=='READY' and not item.ready_at: item.ready_at=datetime.now(timezone.utc)
    if data.status=='DELIVERED' and not item.ready_at: item.ready_at=datetime.now(timezone.utc)
    if data.status=='DELIVERED' and item.product_id:
        p=locked_product(db,item.product_id)
        if p:
            consumed=min(item.quantity,p.reserved_quantity)
            p.quantity=max(0,p.quantity-item.quantity); p.reserved_quantity=max(0,p.reserved_quantity-consumed)
            record_audit(db,'inventory_consumed','product',p.id,user_id=_.id,order_id=item.order_id,meta={'sku':p.sku,'quantity':item.quantity})
    if data.status=='CANCELLED' and item.product_id:
        p=db.get(Product,item.product_id)
        if p:
            release_product(p,item.quantity)
            record_audit(db,'inventory_released','product',p.id,user_id=_.id,order_id=item.order_id,meta={'sku':p.sku,'quantity':item.quantity})
    item.order.status=recompute_order_status(item.order)
    record_audit(db,'item_status_changed','order_item',item.id,user_id=_.id,order_id=item.order_id,meta={'from':previous,'to':data.status})
    if data.status=='READY': maybe_queue_ready_notification(db,item)
    db.commit()
    return load_order(db,item.order_id)
@router.post('/items/{item_id}/photo',summary='Upload a jewellery photo for an item (stored in S3/MinIO)')
def upload_photo(item_id:int,file:UploadFile=File(...),db:Session=Depends(get_db),_=Depends(current_user)):
    item=db.get(OrderItem,item_id)
    if not item: raise HTTPException(404,'Item not found')
    if not (file.content_type or '').startswith('image/'): raise HTTPException(400,'Only image uploads are supported')
    key=f"orders/{item.order_id}/items/{item.id}/{uuid.uuid4().hex}-{safe_filename(file.filename)}"
    upload(key,file.file,file.content_type); item.photo_key=key; db.commit()
    return {'photo_key':key,'url':presigned(key)}
@router.get('/items/{item_id}/photo-url',summary='Get a presigned URL for the item photo')
def photo_url(item_id:int,db:Session=Depends(get_db),_=Depends(current_user)):
    item=db.get(OrderItem,item_id)
    if not item: raise HTTPException(404,'Item not found')
    return {'url':presigned(item.photo_key)}
@router.get('/items/{item_id}/qr',summary='Get a QR code PNG (base64) encoding the item code')
def qr(item_id:int,db:Session=Depends(get_db),_=Depends(current_user)):
    item=db.get(OrderItem,item_id)
    if not item: raise HTTPException(404,'Item not found')
    img=qrcode.make(item.item_code); buf=io.BytesIO(); img.save(buf,format='PNG')  # pyright: ignore[reportCallIssue] - qrcode image save signature
    return {'item_code':item.item_code,'png_base64':base64.b64encode(buf.getvalue()).decode()}
@router.post('/items/{item_id}/notify-ready',summary='Queue a WhatsApp ready notification for a READY item (respects opt-in, idempotent)')
def notify_ready(item_id:int,db:Session=Depends(get_db),_=Depends(current_user)):
    item=db.query(OrderItem).options(joinedload(OrderItem.order)).filter(OrderItem.id==item_id).first()
    if not item: raise HTTPException(404,'Item not found')
    if item.status!='READY': raise HTTPException(400,'Item is not READY')
    customer=db.get(Customer,item.order.customer_id)
    if not customer or not customer.whatsapp_opt_in: raise HTTPException(400,'Customer has not opted in to WhatsApp notifications')
    existing=db.query(Notification).filter(Notification.order_item_id==item.id,Notification.status.in_({'QUEUED','SENT'})).first()
    if existing: raise HTTPException(409,'A notification for this item is already queued or sent')
    n=Notification(customer_id=customer.id,order_id=item.order_id,order_item_id=item.id,channel='WHATSAPP',type='ORDER_READY',status='QUEUED'); db.add(n); db.flush()
    record_audit(db,'notification_queued','notification',n.id,user_id=_.id,order_id=item.order_id,meta={'type':'ORDER_READY'})
    db.commit()
    send_whatsapp_task.delay(n.id)
    return {'notification_id':n.id,'status':'QUEUED'}
