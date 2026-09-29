from sqlalchemy import String,Integer,Numeric,Boolean,Text,DateTime
from sqlalchemy.orm import Mapped,mapped_column,relationship
from sqlalchemy.sql import func
from app.db.base import Base
class Product(Base):
    __tablename__='products'
    id:Mapped[int]=mapped_column(primary_key=True)
    sku:Mapped[str]=mapped_column(String(60),unique=True,index=True)
    name:Mapped[str]=mapped_column(String(150),index=True)
    category:Mapped[str]=mapped_column(String(80),default='GOLD',index=True)
    description:Mapped[str|None]=mapped_column(Text)
    unit_weight_g:Mapped[float|None]=mapped_column(Numeric(10,3))
    price:Mapped[float|None]=mapped_column(Numeric(12,2))
    quantity:Mapped[int]=mapped_column(Integer,default=0)
    reserved_quantity:Mapped[int]=mapped_column(Integer,default=0,server_default='0')
    min_quantity:Mapped[int]=mapped_column(Integer,default=2)
    is_active:Mapped[bool]=mapped_column(Boolean,default=True)
    created_at:Mapped[DateTime]=mapped_column(DateTime(timezone=True),server_default=func.now())
    updated_at:Mapped[DateTime]=mapped_column(DateTime(timezone=True),server_default=func.now(),onupdate=func.now())
    order_items=relationship('OrderItem',back_populates='product')
    @property
    def available_quantity(self)->int:
        return self.quantity-self.reserved_quantity
