from pydantic import BaseModel
from datetime import datetime
from .common import ORMModel
class AuditOut(ORMModel): id:int; event_type:str; entity:str; entity_id:int|None; order_id:int|None; user_id:int|None; meta:dict|None; created_at:datetime
