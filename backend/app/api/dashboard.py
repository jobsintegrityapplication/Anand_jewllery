from datetime import datetime,timedelta,timezone
from fastapi import APIRouter,Depends
from sqlalchemy import func
from sqlalchemy.orm import Session,joinedload
from app.db.session import get_db
from app.models.customer import Customer
from app.models.order import Order,OrderItem
from app.models.product import Product
from app.models.notification import Notification
from app.schemas.order import OrderOut
from app.core.security import current_user
router=APIRouter(prefix='/dashboard',tags=['dashboard'])
@router.get('/summary')
def summary(db:Session=Depends(get_db),_=Depends(current_user)):
    customers_total=db.query(func.count(Customer.id)).scalar() or 0
    orders_total=db.query(func.count(Order.id)).scalar() or 0
    order_status={str(s):int(c) for s,c in db.query(Order.status,func.count(Order.id)).group_by(Order.status).all()}
    item_status={str(s):int(c) for s,c in db.query(OrderItem.status,func.count(OrderItem.id)).group_by(OrderItem.status).all()}
    items_pending=sum(v for k,v in item_status.items() if k not in {'READY','DELIVERED','CANCELLED'})
    items_ready=item_status.get('READY',0)
    items_delivered=item_status.get('DELIVERED',0)
    low_stock=db.query(Product).filter(Product.is_active==True,Product.quantity-Product.reserved_quantity<=Product.min_quantity).order_by((Product.quantity-Product.reserved_quantity).asc()).limit(10).all()
    low_stock_out=[{'id':p.id,'sku':p.sku,'name':p.name,'quantity':p.quantity,'reserved_quantity':p.reserved_quantity,'available_quantity':p.available_quantity,'min_quantity':p.min_quantity} for p in low_stock]
    recent=db.query(Order).options(joinedload(Order.items),joinedload(Order.customer)).order_by(Order.id.desc()).limit(10).all()
    recent_customers=db.query(Customer).order_by(Customer.id.desc()).limit(5).all()
    since=datetime.now(timezone.utc)-timedelta(days=13)
    orders_over_time=[{'date':(datetime.now(timezone.utc)-timedelta(days=i)).strftime('%Y-%m-%d'),'count':0} for i in range(13,-1,-1)]
    rows=db.query(func.date(Order.created_at),func.count(Order.id)).filter(Order.created_at>=since).group_by(func.date(Order.created_at)).all()
    counts={str(d):c for d,c in rows}
    for bucket in orders_over_time: bucket['count']=counts.get(bucket['date'],0)
    notifications_queued=db.query(func.count(Notification.id)).filter(Notification.status=='QUEUED').scalar() or 0
    notifications_sent=db.query(func.count(Notification.id)).filter(Notification.status=='SENT').scalar() or 0
    notifications_failed=db.query(func.count(Notification.id)).filter(Notification.status=='FAILED').scalar() or 0
    return {
        'customers_total':customers_total,
        'orders_total':orders_total,
        'orders_open':order_status.get('OPEN',0),
        'orders_in_progress':order_status.get('IN_PROGRESS',0),
        'orders_partially_ready':order_status.get('PARTIALLY_READY',0),
        'orders_ready':order_status.get('READY',0),
        'orders_delivered':order_status.get('DELIVERED',0),
        'orders_cancelled':order_status.get('CANCELLED',0),
        'items_pending':items_pending,
        'items_ready':items_ready,
        'items_delivered':items_delivered,
        'items_by_status':item_status,
        'orders_by_status':order_status,
        'orders_over_time':orders_over_time,
        'low_stock':low_stock_out,
        'notifications_queued':notifications_queued,
        'notifications_sent':notifications_sent,
        'notifications_failed':notifications_failed,
        'recent_orders':[OrderOut.model_validate(o).model_dump() for o in recent],
        'recent_customers':[{'id':c.id,'name':c.name,'phone':c.phone,'whatsapp_opt_in':c.whatsapp_opt_in} for c in recent_customers],
    }
