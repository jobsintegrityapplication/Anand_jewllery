from pydantic import BaseModel,Field
from datetime import datetime
from .common import ORMModel
class ProductCreate(BaseModel): sku:str=Field(min_length=2,max_length=60); name:str=Field(min_length=2,max_length=150); category:str=Field(default='GOLD',max_length=80); description:str|None=None; unit_weight_g:float|None=Field(default=None,ge=0); price:float|None=Field(default=None,ge=0); quantity:int=Field(default=0,ge=0); min_quantity:int=Field(default=2,ge=0)
class ProductUpdate(BaseModel): name:str|None=Field(default=None,min_length=2,max_length=150); category:str|None=Field(default=None,max_length=80); description:str|None=None; unit_weight_g:float|None=Field(default=None,ge=0); price:float|None=Field(default=None,ge=0); quantity:int|None=Field(default=None,ge=0); min_quantity:int|None=Field(default=None,ge=0); is_active:bool|None=None
class ProductOut(ORMModel): id:int; sku:str; name:str; category:str; description:str|None; unit_weight_g:float|None; price:float|None; quantity:int; reserved_quantity:int; available_quantity:int; min_quantity:int; is_active:bool; created_at:datetime
class StockAdjust(BaseModel): delta:int
class StockReserve(BaseModel): quantity:int=Field(ge=1)
