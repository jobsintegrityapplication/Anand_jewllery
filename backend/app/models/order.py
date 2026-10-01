from sqlalchemy import String,Text,Date,DateTime,Integer,Numeric,ForeignKey
from datetime import date,datetime
from decimal import Decimal
from sqlalchemy.orm import Mapped,mapped_column,relationship
from sqlalchemy.sql import func
from app.db.base import Base
class Order(Base):
    __tablename__='orders'
    id:Mapped[int]=mapped_column(primary_key=True)
    order_number:Mapped[str]=mapped_column(String(40),unique=True,index=True)
    customer_id:Mapped[int]=mapped_column(ForeignKey('customers.id'))
    expected_delivery_date:Mapped[object|None]=mapped_column(Date)
    notes:Mapped[str|None]=mapped_column(Text)
    status:Mapped[str]=mapped_column(String(30),default='OPEN')
    invoice_number:Mapped[str|None]=mapped_column(String(60),unique=True,index=True)
    invoice_issued_at:Mapped[DateTime|None]=mapped_column(DateTime(timezone=True))
    created_at:Mapped[DateTime]=mapped_column(DateTime(timezone=True),server_default=func.now())
    updated_at:Mapped[DateTime]=mapped_column(DateTime(timezone=True),server_default=func.now(),onupdate=func.now())
    customer=relationship('Customer',back_populates='orders')
    items=relationship('OrderItem',back_populates='order',cascade='all, delete-orphan')
    payments=relationship('OrderPayment',back_populates='order',cascade='all, delete-orphan',order_by='OrderPayment.id')
class OrderItem(Base):
    __tablename__='order_items'
    id:Mapped[int]=mapped_column(primary_key=True)
    order_id:Mapped[int]=mapped_column(ForeignKey('orders.id',ondelete='CASCADE'),index=True)
    product_id:Mapped[int|None]=mapped_column(ForeignKey('products.id'))
    item_code:Mapped[str]=mapped_column(String(60),unique=True,index=True)
    item_type:Mapped[str]=mapped_column(String(80))
    description:Mapped[str|None]=mapped_column(Text)
    quantity:Mapped[int]=mapped_column(Integer,default=1)
    status:Mapped[str]=mapped_column(String(30),default='ORDER_CREATED')
    expected_date:Mapped[date|None]=mapped_column(Date)
    estimated_value:Mapped[float|None]=mapped_column(Numeric(12,2))
    design:Mapped[str|None]=mapped_column(Text)
    gold_rate:Mapped[float|None]=mapped_column(Numeric(12,2))
    gold_purity:Mapped[str|None]=mapped_column(String(24))
    net_weight_g:Mapped[float|None]=mapped_column(Numeric(12,3))
    count:Mapped[int]=mapped_column(Integer,default=1,server_default='1')
    making_charges:Mapped[float|None]=mapped_column(Numeric(12,2))
    wastage_percent:Mapped[float|None]=mapped_column(Numeric(6,3))
    other_charges:Mapped[float|None]=mapped_column(Numeric(12,2))
    cancellation_reason:Mapped[str|None]=mapped_column(Text)
    ready_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    photo_key:Mapped[str|None]=mapped_column(String(500))
    workshop_notes:Mapped[str|None]=mapped_column(Text)
    created_at:Mapped[DateTime]=mapped_column(DateTime(timezone=True),server_default=func.now())
    updated_at:Mapped[DateTime]=mapped_column(DateTime(timezone=True),server_default=func.now(),onupdate=func.now())
    order=relationship('Order',back_populates='items')
    product=relationship('Product',back_populates='order_items')

class OrderPayment(Base):
    __tablename__='order_payments'
    id:Mapped[int]=mapped_column(primary_key=True)
    order_id:Mapped[int]=mapped_column(ForeignKey('orders.id',ondelete='CASCADE'),index=True)
    amount:Mapped[Decimal]=mapped_column(Numeric(12,2),nullable=False)
    method:Mapped[str]=mapped_column(String(30),nullable=False)
    reference:Mapped[str|None]=mapped_column(String(120))
    note:Mapped[str|None]=mapped_column(Text)
    received_by:Mapped[int|None]=mapped_column(ForeignKey('users.id',ondelete='SET NULL'))
    paid_at:Mapped[DateTime]=mapped_column(DateTime(timezone=True),server_default=func.now(),nullable=False)
    order=relationship('Order',back_populates='payments')
