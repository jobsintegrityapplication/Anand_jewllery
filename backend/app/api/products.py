from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.security import current_user, require_roles
from app.db.session import get_db
from app.models.inventory import InventoryTransaction
from app.models.product import Product
from app.schemas.product import (
    InventoryTransactionOut, ProductCreate, ProductOut, ProductUpdate,
    StockAdjust, StockChange, StockReserve,
)
from app.services.audit import record_audit
from app.services.inventory import locked_product, record_transaction, release_product, reserve_product

router = APIRouter(prefix='/products', tags=['products'])


@router.get('', response_model=list[ProductOut], summary='List inventory with search, category/low-stock filters and pagination')
def list_products(response: Response, q: str | None = None, category: str | None = None, low_stock: bool = False, skip: int = 0, limit: int = 50, db: Session = Depends(get_db), _=Depends(current_user)):
    query = db.query(Product).order_by(Product.id.desc())
    if q:
        query = query.filter(Product.name.ilike(f'%{q}%') | Product.sku.ilike(f'%{q}%'))
    if category:
        query = query.filter(Product.category == category.upper())
    if low_stock:
        query = query.filter(Product.quantity - Product.reserved_quantity <= Product.min_quantity, Product.is_active.is_(True))
    response.headers['X-Total-Count'] = str(query.count())
    return query.offset(skip).limit(min(limit, 200)).all()


@router.post('', response_model=ProductOut, summary='Create an inventory item and record its opening balance')
def create_product(data: ProductCreate, db: Session = Depends(get_db), user=Depends(current_user)):
    if db.query(Product).filter(Product.sku == data.sku).first():
        raise HTTPException(409, 'Product SKU already exists')
    product = Product(**data.model_dump())
    db.add(product)
    db.flush()
    if product.quantity:
        record_transaction(db, product, 'OPENING', quantity_delta=product.quantity, reason='Opening stock', user_id=user.id)
    record_audit(db, 'inventory_created', 'product', product.id, user_id=user.id, meta={'sku': product.sku, 'quantity': float(product.quantity), 'unit': product.unit})
    db.commit()
    db.refresh(product)
    return product


@router.get('/{product_id}/transactions', response_model=list[InventoryTransactionOut], summary='List stock and reservation history for a product')
def product_transactions(product_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _=Depends(current_user)):
    if not db.get(Product, product_id):
        raise HTTPException(404, 'Product not found')
    return (db.query(InventoryTransaction).filter(InventoryTransaction.product_id == product_id)
            .order_by(InventoryTransaction.created_at.desc(), InventoryTransaction.id.desc())
            .offset(skip).limit(min(limit, 500)).all())


@router.get('/{product_id}', response_model=ProductOut, summary='Get a single inventory item')
def get_product(product_id: int, db: Session = Depends(get_db), _=Depends(current_user)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, 'Product not found')
    return product


@router.patch('/{product_id}', response_model=ProductOut, summary='Update inventory details; stock must change through a transaction')
def update_product(product_id: int, data: ProductUpdate, db: Session = Depends(get_db), user=Depends(current_user)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, 'Product not found')
    if data.quantity is not None:
        raise HTTPException(409, 'Use Add Stock, Remove Stock or Adjust Stock to preserve transaction history.')
    fields = data.model_dump(exclude_unset=True, exclude={'quantity'})
    for key, value in fields.items():
        setattr(product, key, value)
    record_audit(db, 'inventory_updated', 'product', product.id, user_id=user.id, meta={'fields': list(fields.keys())})
    db.commit()
    db.refresh(product)
    return product


@router.post('/{product_id}/stock/add', response_model=ProductOut, summary='Add stock with reference and reason')
def add_stock(product_id: int, data: StockChange, db: Session = Depends(get_db), user=Depends(current_user)):
    product = locked_product(db, product_id)
    if not product:
        raise HTTPException(404, 'Product not found')
    amount = Decimal(str(data.quantity))
    product.quantity += amount
    record_transaction(db, product, 'ADD', quantity_delta=amount, reference=data.reference, reason=data.reason, user_id=user.id, transaction_date=data.transaction_date)
    record_audit(db, 'inventory_stock_added', 'product', product.id, user_id=user.id, meta={'quantity': data.quantity, 'unit': product.unit, 'reference': data.reference, 'reason': data.reason})
    db.commit()
    db.refresh(product)
    return product


@router.post('/{product_id}/stock/remove', response_model=ProductOut, summary='Remove available stock with reference and reason')
def remove_stock(product_id: int, data: StockChange, db: Session = Depends(get_db), user=Depends(current_user)):
    product = locked_product(db, product_id)
    if not product:
        raise HTTPException(404, 'Product not found')
    amount = Decimal(str(data.quantity))
    available = product.quantity - product.reserved_quantity
    if amount > available:
        raise HTTPException(409, f'Removal exceeds available stock ({available} {product.unit})')
    product.quantity -= amount
    record_transaction(db, product, 'REMOVE', quantity_delta=-amount, reference=data.reference, reason=data.reason, user_id=user.id, transaction_date=data.transaction_date)
    record_audit(db, 'inventory_stock_removed', 'product', product.id, user_id=user.id, meta={'quantity': data.quantity, 'unit': product.unit, 'reference': data.reference, 'reason': data.reason})
    db.commit()
    db.refresh(product)
    return product


@router.post('/{product_id}/adjust', response_model=ProductOut, summary='Reconcile stock by a signed amount and record the reason')
def adjust_stock(product_id: int, data: StockAdjust, db: Session = Depends(get_db), user=Depends(current_user)):
    product = locked_product(db, product_id)
    if not product:
        raise HTTPException(404, 'Product not found')
    delta = Decimal(str(data.delta))
    if delta == 0:
        raise HTTPException(422, 'Adjustment must be non-zero')
    next_quantity = product.quantity + delta
    if next_quantity < product.reserved_quantity:
        raise HTTPException(409, f'Adjustment would make stock lower than reserved stock ({product.reserved_quantity} {product.unit})')
    product.quantity = next_quantity
    record_transaction(db, product, 'ADJUST', quantity_delta=delta, reference=data.reference, reason=data.reason, user_id=user.id, transaction_date=data.transaction_date)
    record_audit(db, 'inventory_adjusted', 'product', product.id, user_id=user.id, meta={'delta': data.delta, 'unit': product.unit, 'reference': data.reference, 'reason': data.reason})
    db.commit()
    db.refresh(product)
    return product


@router.post('/{product_id}/reserve', response_model=ProductOut, summary='Reserve available stock')
def reserve_stock(product_id: int, data: StockReserve, db: Session = Depends(get_db), user=Depends(current_user)):
    product = locked_product(db, product_id)
    if not product:
        raise HTTPException(404, 'Product not found')
    reserve_product(product, data.quantity)
    record_transaction(db, product, 'RESERVE', reserved_delta=data.quantity, reason='Manual stock reservation', user_id=user.id)
    record_audit(db, 'inventory_reserved', 'product', product.id, user_id=user.id, meta={'quantity': data.quantity, 'unit': product.unit})
    db.commit()
    db.refresh(product)
    return product


@router.post('/{product_id}/release', response_model=ProductOut, summary='Release reserved stock')
def release_stock(product_id: int, data: StockReserve, db: Session = Depends(get_db), user=Depends(current_user)):
    product = locked_product(db, product_id)
    if not product:
        raise HTTPException(404, 'Product not found')
    if product.reserved_quantity < Decimal(str(data.quantity)):
        raise HTTPException(409, f'Cannot release more than reserved ({product.reserved_quantity} {product.unit})')
    release_product(product, data.quantity)
    record_transaction(db, product, 'RELEASE', reserved_delta=-data.quantity, reason='Manual reservation release', user_id=user.id)
    record_audit(db, 'inventory_released', 'product', product.id, user_id=user.id, meta={'quantity': data.quantity, 'unit': product.unit})
    db.commit()
    db.refresh(product)
    return product


@router.post('/{product_id}/transactions/{transaction_id}/reverse', response_model=InventoryTransactionOut, summary='Reverse a stock add, removal or adjustment')
def reverse_transaction(product_id: int, transaction_id: int, db: Session = Depends(get_db), user=Depends(current_user)):
    product = locked_product(db, product_id)
    if not product:
        raise HTTPException(404, 'Product not found')
    original = db.query(InventoryTransaction).filter_by(id=transaction_id, product_id=product_id).first()
    if not original:
        raise HTTPException(404, 'Inventory transaction not found')
    if original.transaction_type not in {'ADD', 'REMOVE', 'ADJUST', 'OPENING'}:
        raise HTTPException(409, 'This transaction type cannot be reversed directly.')
    if db.query(InventoryTransaction).filter_by(reversal_of_id=original.id).first():
        raise HTTPException(409, 'This transaction has already been reversed.')
    delta = -Decimal(str(original.quantity_delta))
    next_quantity = product.quantity + delta
    if next_quantity < product.reserved_quantity:
        raise HTTPException(409, 'Reversal would reduce stock below reserved quantity.')
    product.quantity = next_quantity
    reversal = InventoryTransaction(product_id=product.id, transaction_type='REVERSAL', quantity_delta=delta,
        reserved_delta=0, balance_after=next_quantity, unit=product.unit, reference=original.reference,
        reason=f'Reversal of transaction {original.id}', order_id=original.order_id,
        order_item_id=original.order_item_id, reversal_of_id=original.id, user_id=user.id)
    db.add(reversal)
    record_audit(db, 'inventory_transaction_reversed', 'product', product.id, user_id=user.id,
        order_id=original.order_id, meta={'transaction_id': original.id, 'quantity_delta': float(delta)})
    db.commit()
    db.refresh(reversal)
    return reversal


@router.delete('/{product_id}', summary='Soft-deactivate an inventory item (ADMIN role required)')
def delete_product(product_id: int, db: Session = Depends(get_db), user=Depends(require_roles('ADMIN'))):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, 'Product not found')
    if product.reserved_quantity > 0:
        raise HTTPException(409, 'Release or fulfill reserved stock before deactivating this item.')
    product.is_active = False
    record_audit(db, 'inventory_deleted', 'product', product.id, user_id=user.id, meta={'sku': product.sku, 'quantity_retained': float(product.quantity)})
    db.commit()
    return {'id': product_id, 'is_active': False}
