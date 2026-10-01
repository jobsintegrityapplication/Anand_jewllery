import re
from pydantic import BaseModel,Field,field_validator
from datetime import datetime
from .common import ORMModel
class CustomerCreate(BaseModel):
    name:str=Field(min_length=2,max_length=150); phone:str=Field(min_length=8,max_length=20,pattern=r'^\+?[0-9][0-9\s\-]{5,18}$'); email:str|None=Field(default=None,max_length=150); address:str|None=None; whatsapp_opt_in:bool=False; notes:str|None=None
    @field_validator('email')
    @classmethod
    def valid_email(cls,value):
        if value and not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',value.strip()): raise ValueError('Enter a valid email address')
        return value.strip() if value else value
class CustomerUpdate(BaseModel):
    name:str|None=Field(default=None,min_length=2,max_length=150); phone:str|None=Field(default=None,min_length=8,max_length=20,pattern=r'^\+?[0-9][0-9\s\-]{5,18}$'); email:str|None=Field(default=None,max_length=150); address:str|None=None; whatsapp_opt_in:bool|None=None; notes:str|None=None
    @field_validator('email')
    @classmethod
    def valid_email(cls,value):
        if value and not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',value.strip()): raise ValueError('Enter a valid email address')
        return value.strip() if value else value
class CustomerOut(ORMModel): id:int; name:str; phone:str; email:str|None; address:str|None; whatsapp_opt_in:bool; notes:str|None; created_at:datetime; updated_at:datetime
class CustomerListOut(CustomerOut): order_count:int=0; latest_order_status:str|None=None
