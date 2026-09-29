import asyncio
from datetime import datetime,timezone
from celery import Celery
from celery.exceptions import MaxRetriesExceededError
from app.core.config import settings
celery_app=Celery('anand',broker=settings.REDIS_URL,backend=settings.REDIS_URL)
celery_app.conf.task_routes={'app.tasks.celery_app.send_whatsapp_task':{'queue':'notifications'}}
celery_app.conf.task_acks_late=True
celery_app.conf.worker_prefetch_multiplier=1
@celery_app.task(name='app.tasks.celery_app.send_whatsapp_task',bind=True,autoretry_for=(ConnectionError,TimeoutError),retry_backoff=True,retry_backoff_max=600,retry_jitter=True,max_retries=3)
def send_whatsapp_task(self,notification_id:int):
    from app.db.session import SessionLocal
    from app.models.notification import Notification
    from app.models.order import Order
    from app.models.customer import Customer
    from app.services.whatsapp import send_template,send_text
    from app.services.templates import configured_template,render_template
    db=SessionLocal()
    n=None
    try:
        n=db.get(Notification,notification_id)
        if not n or n.status=='SENT': return
        customer=db.get(Customer,n.customer_id)
        if not customer: return
        order=db.get(Order,n.order_id) if n.order_id else None
        order_number=order.order_number if order else ''
        context={'customer_name':customer.name,'order_number':order_number,'message':n.message or ''}
        message=render_template(configured_template(n.type or 'CUSTOM'),context)
        if settings.WHATSAPP_ENABLED and settings.WHATSAPP_READY_TEMPLATE_NAME and n.type in {'ORDER_CREATED','ORDER_IN_PROGRESS','ORDER_READY','ORDER_DELIVERED'}:
            params=[p for p in [customer.name,order_number,message] if p]
            result=asyncio.run(send_template(customer.phone,settings.WHATSAPP_READY_TEMPLATE_NAME,params))
        else:
            result=asyncio.run(send_text(customer.phone,message))
        n.status=result['status']; n.message=message; n.provider_message_id=result.get('message_id'); n.error=None; n.sent_at=datetime.now(timezone.utc) if result['status']=='SENT' else None
        db.commit()
    except Exception as e:
        if n:
            n.status='FAILED'; n.error=str(e); n.retry_count=(n.retry_count or 0)+1; db.commit()
            try:
                raise self.retry(exc=e)
            except MaxRetriesExceededError:
                pass
        else:
            raise
    finally:
        db.close()
