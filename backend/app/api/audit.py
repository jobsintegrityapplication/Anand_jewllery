from fastapi import APIRouter,Depends,Response
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.audit import AuditLog
from app.schemas.audit import AuditOut
from app.core.security import require_roles
router=APIRouter(prefix='/audit',tags=['audit'])
@router.get('',response_model=list[AuditOut],summary='List audit events with entity/event-type/order filters')
def list_audit(response:Response,entity:str|None=None,entity_id:int|None=None,event_type:str|None=None,order_id:int|None=None,limit:int=100,skip:int=0,db:Session=Depends(get_db),_=Depends(require_roles('ADMIN'))):
    query=db.query(AuditLog).order_by(AuditLog.created_at.desc(),AuditLog.id.desc())
    if entity: query=query.filter(AuditLog.entity==entity.lower())
    if entity_id is not None: query=query.filter(AuditLog.entity_id==entity_id)
    if event_type: query=query.filter(AuditLog.event_type==event_type.lower())
    if order_id is not None: query=query.filter(AuditLog.order_id==order_id)
    total=query.count()
    response.headers['X-Total-Count']=str(total)
    return query.offset(skip).limit(min(limit,500)).all()
