from fastapi import APIRouter,Depends,HTTPException,Response
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.db.session import get_db
from app.models.product import Product
from app.schemas.product import ProductCreate,ProductUpdate,ProductOut,StockAdjust,StockReserve
from app.core.security import current_user,require_roles
from app.services.audit import record_audit
from app.services.inventory import locked_product,reserve_product,release_product
router=APIRouter(prefix='/products',tags=['products'])
@router.get('',response_model=list[ProductOut],summary='List inventory items with search, category/low-stock filters and pagination')
def list_products(response:Response,q:str|None=None,category:str|None=None,low_stock:bool=False,skip:int=0,limit:int=50,db:Session=Depends(get_db),_=Depends(current_user)):
    query=db.query(Product).order_by(Product.id.desc())
    if q: query=query.filter(or_(Product.name.ilike(f'%{q}%'),Product.sku.ilike(f'%{q}%')))
    if category: query=query.filter(Product.category==category.upper())
    if low_stock: query=query.filter(Product.quantity-Product.reserved_quantity<=Product.min_quantity,Product.is_active==True)
    total=query.count()
    response.headers['X-Total-Count']=str(total)
    return query.offset(skip).limit(min(limit,200)).all()
@router.post('',response_model=ProductOut,summary='Create an inventory item (duplicate SKUs are rejected)')
def create_product(data:ProductCreate,db:Session=Depends(get_db),_=Depends(current_user)):
    if db.query(Product).filter(Product.sku==data.sku).first(): raise HTTPException(409,'Product SKU already exists')
    p=Product(**data.model_dump()); db.add(p); db.commit(); db.refresh(p)
    record_audit(db,'inventory_created','product',p.id,user_id=_.id,meta={'sku':p.sku,'quantity':p.quantity}); db.commit()
    return p
@router.get('/{product_id}',response_model=ProductOut,summary='Get a single inventory item')
def get_product(product_id:int,db:Session=Depends(get_db),_=Depends(current_user)):
    p=db.get(Product,product_id)
    if not p: raise HTTPException(404,'Product not found')
    return p
@router.patch('/{product_id}',response_model=ProductOut,summary='Update inventory item fields (quantity cannot drop below reserved)')
def update_product(product_id:int,data:ProductUpdate,db:Session=Depends(get_db),_=Depends(current_user)):
    p=db.get(Product,product_id)
    if not p: raise HTTPException(404,'Product not found')
    if data.quantity is not None and data.quantity<p.reserved_quantity: raise HTTPException(409,f'Quantity cannot be below reserved stock ({p.reserved_quantity})')
    for k,v in data.model_dump(exclude_unset=True).items(): setattr(p,k,v)
    record_audit(db,'inventory_updated','product',p.id,user_id=_.id,meta={'fields':list(data.model_dump(exclude_unset=True).keys())})
    db.commit(); db.refresh(p); return p
@router.post('/{product_id}/adjust',response_model=ProductOut,summary='Adjust stock by a positive or negative delta')
def adjust_stock(product_id:int,data:StockAdjust,db:Session=Depends(get_db),_=Depends(current_user)):
    p=db.get(Product,product_id)
    if not p: raise HTTPException(404,'Product not found')
    new_quantity=p.quantity+data.delta
    if new_quantity<0: raise HTTPException(409,f'Stock adjustment would make quantity negative (current {p.quantity}, delta {data.delta})')
    if new_quantity<p.reserved_quantity: raise HTTPException(409,f'Stock adjustment would make quantity below reserved stock ({p.reserved_quantity})')
    p.quantity=new_quantity
    record_audit(db,'inventory_adjusted','product',p.id,user_id=_.id,meta={'sku':p.sku,'delta':data.delta,'new_quantity':new_quantity})
    db.commit(); db.refresh(p); return p
@router.post('/{product_id}/reserve',response_model=ProductOut,summary='Reserve stock (validated against available quantity)')
def reserve_stock(product_id:int,data:StockReserve,db:Session=Depends(get_db),_=Depends(current_user)):
    p=locked_product(db,product_id)
    if not p: raise HTTPException(404,'Product not found')
    reserve_product(p,data.quantity)
    record_audit(db,'inventory_reserved','product',p.id,user_id=_.id,meta={'sku':p.sku,'quantity':data.quantity})
    db.commit(); db.refresh(p); return p
@router.post('/{product_id}/release',response_model=ProductOut,summary='Release previously reserved stock')
def release_stock(product_id:int,data:StockReserve,db:Session=Depends(get_db),_=Depends(current_user)):
    p=locked_product(db,product_id)
    if not p: raise HTTPException(404,'Product not found')
    if p.reserved_quantity<data.quantity: raise HTTPException(409,f'Cannot release more than reserved ({p.reserved_quantity})')
    release_product(p,data.quantity)
    record_audit(db,'inventory_released','product',p.id,user_id=_.id,meta={'sku':p.sku,'quantity':data.quantity})
    db.commit(); db.refresh(p); return p
@router.delete('/{product_id}',summary='Soft-delete an inventory item (ADMIN role required)')
def delete_product(product_id:int,db:Session=Depends(get_db),user=Depends(require_roles('ADMIN'))):
    p=db.get(Product,product_id)
    if not p: raise HTTPException(404,'Product not found')
    p.is_active=False; p.quantity=0; p.reserved_quantity=0; db.commit()
    record_audit(db,'inventory_deleted','product',p.id,user_id=user.id,meta={'sku':p.sku}); db.commit()
    return {'id':product_id,'is_active':False}
