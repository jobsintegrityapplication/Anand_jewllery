from sqlalchemy import String,Boolean,Text,DateTime
from sqlalchemy.orm import Mapped,mapped_column,relationship
from sqlalchemy.sql import func
from app.db.base import Base
class Customer(Base):
    __tablename__='customers'
    id:Mapped[int]=mapped_column(primary_key=True)
    name:Mapped[str]=mapped_column(String(150),index=True)
    phone:Mapped[str]=mapped_column(String(20),unique=True,index=True)
    email:Mapped[str|None]=mapped_column(String(150))
    address:Mapped[str|None]=mapped_column(Text)
    whatsapp_opt_in:Mapped[bool]=mapped_column(Boolean,default=False)
    notes:Mapped[str|None]=mapped_column(Text)
    created_at:Mapped[DateTime]=mapped_column(DateTime(timezone=True),server_default=func.now())
    updated_at:Mapped[DateTime]=mapped_column(DateTime(timezone=True),server_default=func.now(),onupdate=func.now())
    orders=relationship('Order',back_populates='customer')
