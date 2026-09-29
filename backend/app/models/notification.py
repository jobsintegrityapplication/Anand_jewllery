from sqlalchemy import String,Text,DateTime,ForeignKey,Integer
from datetime import datetime
from sqlalchemy.orm import Mapped,mapped_column,relationship
from sqlalchemy.sql import func
from app.db.base import Base
class Notification(Base):
    __tablename__='notifications'
    id:Mapped[int]=mapped_column(primary_key=True)
    customer_id:Mapped[int]=mapped_column(ForeignKey('customers.id'),index=True)
    order_id:Mapped[int|None]=mapped_column(ForeignKey('orders.id'),index=True)
    order_item_id:Mapped[int|None]=mapped_column(ForeignKey('order_items.id'),index=True)
    channel:Mapped[str]=mapped_column(String(30))
    type:Mapped[str|None]=mapped_column(String(60))
    message:Mapped[str|None]=mapped_column(Text)
    status:Mapped[str]=mapped_column(String(30),default='QUEUED',index=True)
    provider_message_id:Mapped[str|None]=mapped_column(String(255))
    error:Mapped[str|None]=mapped_column(Text)
    retry_count:Mapped[int]=mapped_column(Integer,default=0,server_default='0')
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),server_default=func.now(),index=True)
    sent_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    customer=relationship('Customer')
    order=relationship('Order')
    @property
    def order_number(self)->str|None:
        return self.order.order_number if self.order else None
