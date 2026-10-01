from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class InventoryTransaction(Base):
    __tablename__ = 'inventory_transactions'

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), index=True)
    transaction_type: Mapped[str] = mapped_column(String(20), index=True)
    quantity_delta: Mapped[float] = mapped_column(Numeric(12, 3), default=0)
    reserved_delta: Mapped[float] = mapped_column(Numeric(12, 3), default=0)
    balance_after: Mapped[float] = mapped_column(Numeric(12, 3))
    unit: Mapped[str] = mapped_column(String(12), default='pcs')
    reference: Mapped[str | None] = mapped_column(String(160))
    reason: Mapped[str | None] = mapped_column(Text)
    order_id: Mapped[int | None] = mapped_column(ForeignKey('orders.id', ondelete='SET NULL'), index=True)
    order_item_id: Mapped[int | None] = mapped_column(ForeignKey('order_items.id', ondelete='SET NULL'), index=True)
    reversal_of_id: Mapped[int | None] = mapped_column(ForeignKey('inventory_transactions.id'), unique=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey('users.id'))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    product = relationship('Product', back_populates='transactions')
