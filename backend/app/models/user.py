from sqlalchemy import String,Boolean,DateTime
from sqlalchemy.orm import Mapped,mapped_column
from sqlalchemy.sql import func
from app.db.base import Base
class User(Base):
    __tablename__='users'
    id:Mapped[int]=mapped_column(primary_key=True)
    username:Mapped[str]=mapped_column(String(80),unique=True,index=True)
    password_hash:Mapped[str]=mapped_column(String(255))
    role:Mapped[str]=mapped_column(String(30),default='STAFF')
    is_active:Mapped[bool]=mapped_column(Boolean,default=True)
    created_at:Mapped[DateTime]=mapped_column(DateTime(timezone=True),server_default=func.now())
