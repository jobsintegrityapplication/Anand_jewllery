from sqlalchemy.orm import Session
from app.models.audit import AuditLog

def record_audit(db:Session,event_type:str,entity:str,entity_id:int|None=None,user_id:int|None=None,order_id:int|None=None,meta:dict|None=None):
    # Adds an audit row without committing; callers commit inside their own
    # transaction so the audit entry is written atomically with the change.
    db.add(AuditLog(event_type=event_type,entity=entity,entity_id=entity_id,user_id=user_id,order_id=order_id,meta=meta))
