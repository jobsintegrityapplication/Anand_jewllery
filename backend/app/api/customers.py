from fastapi import APIRouter,Depends,HTTPException,Response
from sqlalchemy.orm import Session
from sqlalchemy import or_,func
from app.db.session import get_db
from app.models.customer import Customer
from app.models.order import Order,OrderItem
from app.schemas.customer import CustomerCreate,CustomerUpdate,CustomerOut
from app.core.security import current_user
from app.services.audit import record_audit
router=APIRouter(prefix='/customers',tags=['customers'])
@router.get('',response_model=list[CustomerOut],summary='List customers with search (name/phone/email) and pagination')
def list_customers(response:Response,q:str|None=None,skip:int=0,limit:int=50,db:Session=Depends(get_db),_=Depends(current_user)):
    query=db.query(Customer).order_by(Customer.id.desc())
    if q: query=query.filter(or_(Customer.name.ilike(f'%{q}%'),Customer.phone.ilike(f'%{q}%'),Customer.email.ilike(f'%{q}%')))
    total=query.count()
    response.headers['X-Total-Count']=str(total)
    return query.offset(skip).limit(min(limit,200)).all()
@router.post('',response_model=CustomerOut,summary='Create a customer (duplicate phone numbers are rejected)')
def create_customer(data:CustomerCreate,db:Session=Depends(get_db),_=Depends(current_user)):
    if db.query(Customer).filter(Customer.phone==data.phone).first(): raise HTTPException(409,'Customer phone already exists')
    c=Customer(**data.model_dump()); db.add(c); db.commit(); db.refresh(c)
    record_audit(db,'customer_created','customer',c.id,user_id=_.id,meta={'name':c.name,'phone':c.phone}); db.commit()
    return c
@router.get('/{customer_id}',response_model=CustomerOut,summary='Get a single customer')
def get_customer(customer_id:int,db:Session=Depends(get_db),_=Depends(current_user)):
    c=db.get(Customer,customer_id)
    if not c: raise HTTPException(404,'Customer not found')
    return c
@router.get('/{customer_id}/summary',summary='Order/item statistics for one customer')
def customer_summary(customer_id:int,db:Session=Depends(get_db),_=Depends(current_user)):
    c=db.get(Customer,customer_id)
    if not c: raise HTTPException(404,'Customer not found')
    order_ids=[o.id for o in db.query(Order.id).filter(Order.customer_id==customer_id).all()]
    orders_total=len(order_ids)
    if not orders_total:
        return {'orders_total':0,'orders_open':0,'orders_ready':0,'orders_delivered':0,'orders_in_progress':0,'items_total':0,'items_pending':0,'items_ready':0,'items_delivered':0}
    items_q=db.query(OrderItem).join(Order,OrderItem.order_id==Order.id).filter(Order.customer_id==customer_id)
    items_total=items_q.count()
    def count_statuses(statuses:set[str])->int:
        return items_q.filter(OrderItem.status.in_(statuses)).count()
    orders_by_status={str(s):int(c) for s,c in db.query(Order.status,func.count(Order.id)).filter(Order.customer_id==customer_id).group_by(Order.status).all()}
    return {
        'orders_total':orders_total,
        'orders_open':orders_by_status.get('OPEN',0),
        'orders_in_progress':orders_by_status.get('IN_PROGRESS',0)+orders_by_status.get('PARTIALLY_READY',0),
        'orders_ready':orders_by_status.get('READY',0),
        'orders_delivered':orders_by_status.get('DELIVERED',0),
        'items_total':items_total,
        'items_pending':count_statuses({'ORDER_CREATED','SENT_TO_WORKSHOP','IN_PROGRESS','QUALITY_CHECK','REWORK_REQUIRED','ON_HOLD'}),
        'items_ready':count_statuses({'READY'}),
        'items_delivered':count_statuses({'DELIVERED'}),
    }
@router.patch('/{customer_id}',response_model=CustomerOut,summary='Update customer fields (partial update)')
def update_customer(customer_id:int,data:CustomerUpdate,db:Session=Depends(get_db),_=Depends(current_user)):
    c=db.get(Customer,customer_id)
    if not c: raise HTTPException(404,'Customer not found')
    if data.phone and data.phone!=c.phone and db.query(Customer).filter(Customer.phone==data.phone).first(): raise HTTPException(409,'Customer phone already exists')
    for k,v in data.model_dump(exclude_unset=True).items(): setattr(c,k,v)
    record_audit(db,'customer_updated','customer',c.id,user_id=_.id,meta={'fields':list(data.model_dump(exclude_unset=True).keys())})
    db.commit(); db.refresh(c); return c
@router.delete('/{customer_id}',summary='Delete a customer (blocked when the customer has orders)')
def delete_customer(customer_id:int,db:Session=Depends(get_db),_=Depends(current_user)):
    c=db.get(Customer,customer_id)
    if not c: raise HTTPException(404,'Customer not found')
    if c.orders: raise HTTPException(409,'Customer has orders and cannot be deleted')
    record_audit(db,'customer_deleted','customer',c.id,user_id=_.id,meta={'name':c.name,'phone':c.phone})
    db.delete(c); db.commit()
    return {'id':customer_id,'deleted':True}
