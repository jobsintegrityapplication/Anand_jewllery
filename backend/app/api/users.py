from fastapi import APIRouter,Depends,HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserCreate,UserUpdate,UserOut
from app.core.security import require_roles,hash_password
from app.services.audit import record_audit
router=APIRouter(prefix='/users',tags=['users'])
@router.get('',response_model=list[UserOut],summary='List users (admin only)')
def list_users(db:Session=Depends(get_db),_=Depends(require_roles('ADMIN'))):
    return db.query(User).order_by(User.id.asc()).all()
@router.post('',response_model=UserOut,summary='Create a user (admin only)')
def create_user(data:UserCreate,db:Session=Depends(get_db),_=Depends(require_roles('ADMIN'))):
    if db.query(User).filter(User.username==data.username).first(): raise HTTPException(409,'Username already exists')
    u=User(username=data.username,password_hash=hash_password(data.password),role=data.role); db.add(u); db.commit(); db.refresh(u)
    record_audit(db,'user_created','user',u.id,user_id=_.id,meta={'username':u.username,'role':u.role}); db.commit()
    return u
@router.patch('/{user_id}',response_model=UserOut,summary='Update a user: role, activation, password reset (admin only)')
def update_user(user_id:int,data:UserUpdate,db:Session=Depends(get_db),_=Depends(require_roles('ADMIN'))):
    u=db.get(User,user_id)
    if not u: raise HTTPException(404,'User not found')
    update=data.model_dump(exclude_unset=True)
    if 'password' in update:
        u.password_hash=hash_password(update.pop('password'))
    if 'role' in update and u.id==_.id and update['role']!='ADMIN':
        raise HTTPException(409,'Cannot remove your own admin role')
    if 'is_active' in update and u.id==_.id and update['is_active'] is False:
        raise HTTPException(409,'Cannot deactivate your own account')
    for k,v in update.items(): setattr(u,k,v)
    record_audit(db,'user_updated','user',u.id,user_id=_.id,meta={'fields':list(update.keys())}); db.commit(); db.refresh(u)
    return u
