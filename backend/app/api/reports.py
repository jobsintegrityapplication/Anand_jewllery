from datetime import datetime,timedelta,timezone
from fastapi import APIRouter,Depends,HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.customer import Customer
from app.models.order import Order,OrderItem
from app.models.notification import Notification
from app.core.security import current_user
router=APIRouter(prefix='/reports',tags=['reports'])
def parse_range(period:str,custom_from:str|None,custom_to:str|None):
    now=datetime.now(timezone.utc)
    end=now
    if period=='custom':
        try:
            start=datetime.fromisoformat(custom_from) if custom_from else now-timedelta(days=30)
            end=datetime.fromisoformat(custom_to) if custom_to else now
        except ValueError: raise HTTPException(400,'Invalid custom range, use ISO format YYYY-MM-DD')
    elif period=='today': start=now-timedelta(days=1)
    elif period=='7d': start=now-timedelta(days=7)
    elif period=='30d': start=now-timedelta(days=30)
    elif period=='month': start=now.replace(day=1,hour=0,minute=0,second=0,microsecond=0)
    else: raise HTTPException(400,'Invalid period, use today|7d|30d|month|custom')
    return start,end
@router.get('/summary',summary='Report summary: orders by status/date, customer growth, repeat customers, notification results')
def reports(period:str='30d',custom_from:str|None=None,custom_to:str|None=None,db:Session=Depends(get_db),_=Depends(current_user)):
    start,end=parse_range(period,custom_from,custom_to)
    orders_q=db.query(Order).filter(Order.created_at>=start,Order.created_at<=end)
    orders_by_status={str(s):int(c) for s,c in orders_q.with_entities(Order.status,func.count(Order.id)).group_by(Order.status).all()}
    orders_by_date_rows=orders_q.with_entities(func.date(Order.created_at),func.count(Order.id)).group_by(func.date(Order.created_at)).all()
    orders_by_date=[{'date':str(d),'count':int(c)} for d,c in orders_by_date_rows]
    customers_q=db.query(Customer).filter(Customer.created_at>=start,Customer.created_at<=end)
    customers_by_date_rows=customers_q.with_entities(func.date(Customer.created_at),func.count(Customer.id)).group_by(func.date(Customer.created_at)).all()
    customer_growth=[{'date':str(d),'count':int(c)} for d,c in customers_by_date_rows]
    # Customers with more than one order (any time, not only the range)
    repeat_rows=db.query(Order.customer_id).group_by(Order.customer_id).having(func.count(Order.id)>1).count()
    items_q=db.query(OrderItem).join(Order,OrderItem.order_id==Order.id).filter(Order.created_at>=start,Order.created_at<=end)
    items_by_status={str(s):int(c) for s,c in items_q.with_entities(OrderItem.status,func.count(OrderItem.id)).group_by(OrderItem.status).all()}
    notifications_by_status={str(s):int(c) for s,c in db.query(Notification.status,func.count(Notification.id)).filter(Notification.created_at>=start,Notification.created_at<=end).group_by(Notification.status).all()}
    return {
        'period':period,
        'from':start.isoformat(),
        'to':end.isoformat(),
        'orders_total':sum(orders_by_status.values()),
        'orders_by_status':orders_by_status,
        'orders_ready':orders_by_status.get('READY',0),
        'orders_pending':orders_by_status.get('OPEN',0)+orders_by_status.get('IN_PROGRESS',0)+orders_by_status.get('PARTIALLY_READY',0),
        'orders_delivered':orders_by_status.get('DELIVERED',0),
        'orders_by_date':orders_by_date,
        'customers_new':sum(int(c['count']) for c in customer_growth),
        'customer_growth':customer_growth,
        'repeat_customers':repeat_rows,
        'items_by_status':items_by_status,
        'notifications_by_status':notifications_by_status,
        'notifications_success':notifications_by_status.get('SENT',0),
        'notifications_failed':notifications_by_status.get('FAILED',0),
    }
