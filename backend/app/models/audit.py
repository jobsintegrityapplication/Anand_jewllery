from sqlalchemy import String,Integer,Text,DateTime,ForeignKey,JSON
from sqlalchemy.orm import Mapped,mapped_column
from sqlalchemy.sql import func
from app.db.base import Base
class AuditLog(Base):
    __tablename__='audit_logs'
    id:Mapped[int]=mapped_column(primary_key=True)
    event_type:Mapped[str]=mapped_column(String(60),index=True)
    entity:Mapped[str]=mapped_column(String(40),index=True)
    entity_id:Mapped[int|None]=mapped_column(Integer,index=True)
    order_id:Mapped[int|None]=mapped_column(Integer,ForeignKey('orders.id'),index=True)
    user_id:Mapped[int|None]=mapped_column(Integer,ForeignKey('users.id'))
    meta:Mapped[dict|None]=mapped_column(JSON)
    created_at:Mapped[DateTime]=mapped_column(DateTime(timezone=True),server_default=func.now(),index=True)
