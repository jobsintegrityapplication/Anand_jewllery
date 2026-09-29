from datetime import datetime
from fastapi import APIRouter,Depends,HTTPException,Response
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.notification import Notification
from app.models.customer import Customer
from app.schemas.notification import NotificationOut,NotificationCreate,RetryResponse
from app.core.security import current_user
from app.services.audit import record_audit
from app.tasks.celery_app import send_whatsapp_task as _send_whatsapp_task
from typing import Any
# celery's decorator typing doesn't expose .delay to type checkers; the runtime
# object is a Task proxy, so the queued calls below are safe.
send_whatsapp_task:Any=_send_whatsapp_task
router=APIRouter(prefix='/notifications',tags=['notifications'])
@router.get('',response_model=list[NotificationOut],summary='List notifications with status/type/customer/order/date filters')
def list_notifications(response:Response,status:str|None=None,type:str|None=None,customer_id:int|None=None,order_id:int|None=None,created_from:str|None=None,created_to:str|None=None,limit:int=50,skip:int=0,db:Session=Depends(get_db),_=Depends(current_user)):
    query=db.query(Notification).order_by(Notification.id.desc())
    if status: query=query.filter(Notification.status==status.upper())
    if type: query=query.filter(Notification.type==type.upper())
    if customer_id: query=query.filter(Notification.customer_id==customer_id)
    if order_id: query=query.filter(Notification.order_id==order_id)
    try:
        if created_from: query=query.filter(Notification.created_at>=datetime.fromisoformat(created_from))
        if created_to: query=query.filter(Notification.created_at<=datetime.fromisoformat(created_to))
    except ValueError: raise HTTPException(400,'Invalid date filter, use ISO format YYYY-MM-DD')
    total=query.count()
    response.headers['X-Total-Count']=str(total)
    return query.offset(skip).limit(min(limit,200)).all()
@router.get('/{notification_id}',response_model=NotificationOut,summary='Get a single notification')
def get_notification(notification_id:int,db:Session=Depends(get_db),_=Depends(current_user)):
    n=db.get(Notification,notification_id)
    if not n: raise HTTPException(404,'Notification not found')
    return n
@router.post('',response_model=NotificationOut,summary='Queue a custom WhatsApp notification for a customer (respects opt-in)')
def create_notification(data:NotificationCreate,db:Session=Depends(get_db),_=Depends(current_user)):
    customer=db.get(Customer,data.customer_id)
    if not customer: raise HTTPException(404,'Customer not found')
    if not customer.whatsapp_opt_in: raise HTTPException(409,'Customer has not opted in to WhatsApp notifications')
    n=Notification(customer_id=data.customer_id,order_id=data.order_id,order_item_id=data.order_item_id,channel='WHATSAPP',type=data.type.upper(),message=data.message,status='QUEUED')
    db.add(n); db.flush()
    record_audit(db,'notification_queued','notification',n.id,user_id=_.id,order_id=data.order_id,meta={'type':data.type.upper()})
    db.commit(); db.refresh(n)
    send_whatsapp_task.delay(n.id)
    return n
@router.post('/{notification_id}/retry',response_model=RetryResponse,summary='Retry a failed notification (idempotent)')
def retry_notification(notification_id:int,db:Session=Depends(get_db),_=Depends(current_user)):
    n=db.get(Notification,notification_id)
    if not n: raise HTTPException(404,'Notification not found')
    if n.status in {'SENT','QUEUED'}: raise HTTPException(409,f'Notification is already {n.status}')
    n.status='QUEUED'; n.error=None; db.commit(); db.refresh(n)
    record_audit(db,'notification_retried','notification',n.id,user_id=_.id,order_id=n.order_id,meta={'retry_count':n.retry_count}); db.commit()
    send_whatsapp_task.delay(n.id)
    return RetryResponse(notification_id=n.id,status='QUEUED')
