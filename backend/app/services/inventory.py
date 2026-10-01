from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.product import Product
from app.models.inventory import InventoryTransaction

def stock_amount(item, product:Product)->Decimal:
    if product.unit == 'g':
        if item.net_weight_g is None or Decimal(str(item.net_weight_g)) <= 0:
            raise HTTPException(422, f'Net weight is required when reserving gram-based stock ({product.sku})')
        return Decimal(str(item.net_weight_g)) * Decimal(str(item.quantity))
    unit_weight=Decimal(str(product.unit_weight_g or 1))
    return Decimal(str(item.quantity)) * unit_weight

def record_transaction(db:Session,product:Product,transaction_type:str,quantity_delta=0,reserved_delta=0,*,reference=None,reason=None,order_id=None,order_item_id=None,user_id=None,transaction_date=None,reversal_of_id=None):
    db.add(InventoryTransaction(
        product_id=product.id,transaction_type=transaction_type,
        quantity_delta=Decimal(str(quantity_delta)),reserved_delta=Decimal(str(reserved_delta)),
        balance_after=Decimal(str(product.quantity)),unit=product.unit,reference=reference,
        reason=reason,order_id=order_id,order_item_id=order_item_id,user_id=user_id,
        created_at=transaction_date,reversal_of_id=reversal_of_id,
    ))

def locked_product(db:Session,product_id:int)->Product|None:
    # Row lock prevents concurrent requests from corrupting stock quantities.
    # SQLite (used by the test suite) has no FOR UPDATE support; locking is a
    # no-op there, while PostgreSQL applies a real row lock.
    query=db.query(Product).filter(Product.id==product_id)
    if db.get_bind().dialect.name=='postgresql': query=query.with_for_update()
    return query.first()

def reserve_product(product:Product,quantity):
    # Caller must hold a FOR UPDATE lock on the product row.
    if not product.is_active:
        raise HTTPException(409,f'Inventory item {product.sku} is inactive')
    amount=Decimal(str(quantity))
    if product.quantity-product.reserved_quantity<amount:
        raise HTTPException(409,f'Insufficient stock for {product.sku} (available {product.quantity-product.reserved_quantity} {product.unit})')
    product.reserved_quantity+=amount

def release_product(product:Product,quantity):
    amount=Decimal(str(quantity))
    product.reserved_quantity=max(Decimal('0'),product.reserved_quantity-amount)
