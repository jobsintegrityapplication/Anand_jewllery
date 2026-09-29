from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.product import Product

def locked_product(db:Session,product_id:int)->Product|None:
    # Row lock prevents concurrent requests from corrupting stock quantities.
    # SQLite (used by the test suite) has no FOR UPDATE support; locking is a
    # no-op there, while PostgreSQL applies a real row lock.
    query=db.query(Product).filter(Product.id==product_id)
    if db.get_bind().dialect.name=='postgresql': query=query.with_for_update()
    return query.first()

def reserve_product(product:Product,quantity:int):
    # Caller must hold a FOR UPDATE lock on the product row.
    if product.quantity-product.reserved_quantity<quantity:
        raise HTTPException(409,f'Insufficient stock for {product.sku} (available {product.quantity-product.reserved_quantity})')
    product.reserved_quantity+=quantity

def release_product(product:Product,quantity:int):
    product.reserved_quantity=max(0,product.reserved_quantity-quantity)
