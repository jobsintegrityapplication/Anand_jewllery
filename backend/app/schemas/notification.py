from pydantic import BaseModel,Field
from datetime import datetime
from .common import ORMModel
from .customer import CustomerOut
class NotificationOut(ORMModel): id:int; customer_id:int; order_id:int|None; order_item_id:int|None; channel:str; type:str|None; message:str|None; status:str; provider_message_id:str|None; error:str|None; retry_count:int; created_at:datetime; sent_at:datetime|None; customer:CustomerOut|None=None; order_number:str|None=None
class NotificationCreate(BaseModel): customer_id:int; order_id:int|None=None; order_item_id:int|None=None; type:str=Field(default='CUSTOM',max_length=60); message:str=Field(min_length=1,max_length=1000)
class RetryResponse(BaseModel): notification_id:int; status:str
