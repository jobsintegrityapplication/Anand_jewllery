from pydantic import BaseModel,Field
from datetime import date,datetime
from .common import ORMModel
from .customer import CustomerOut
class OrderCreate(BaseModel): customer_id:int; expected_delivery_date:date|None=None; notes:str|None=None; items:list['ItemCreate']=[]
class OrderUpdate(BaseModel): expected_delivery_date:date|None=None; notes:str|None=None; status:str|None=None
class ItemCreate(BaseModel): item_type:str=Field(min_length=2,max_length=80); description:str|None=None; product_id:int|None=None; quantity:int=Field(default=1,ge=1); expected_date:date|None=None; estimated_value:float|None=Field(default=None,ge=0); workshop_notes:str|None=None
class ItemStatusUpdate(BaseModel): status:str; workshop_notes:str|None=None
class ItemOut(ORMModel): id:int; item_code:str; item_type:str; description:str|None; quantity:int; status:str; expected_date:date|None; estimated_value:float|None; ready_at:datetime|None; photo_key:str|None; product_id:int|None; workshop_notes:str|None; created_at:datetime
class OrderOut(ORMModel): id:int; order_number:str; customer_id:int; customer:CustomerOut|None=None; expected_delivery_date:date|None; notes:str|None; status:str; created_at:datetime; updated_at:datetime; items:list[ItemOut]=[]
OrderCreate.model_rebuild()
