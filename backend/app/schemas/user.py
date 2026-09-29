from pydantic import BaseModel,Field
from datetime import datetime
from .common import ORMModel
class UserCreate(BaseModel): username:str=Field(min_length=3,max_length=80); password:str=Field(min_length=8,max_length=128); role:str=Field(default='STAFF',pattern='^(ADMIN|STAFF)$')
class UserUpdate(BaseModel): password:str|None=Field(default=None,min_length=8,max_length=128); role:str|None=Field(default=None,pattern='^(ADMIN|STAFF)$'); is_active:bool|None=None
class UserOut(ORMModel): id:int; username:str; role:str; is_active:bool; created_at:datetime
