from datetime import datetime,timedelta,timezone
from jose import jwt,JWTError
from passlib.context import CryptContext
from fastapi import Depends,HTTPException,status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
pwd=CryptContext(schemes=['bcrypt'],deprecated='auto')
oauth=OAuth2PasswordBearer(tokenUrl='/api/auth/login')
def hash_password(p): return pwd.hash(p)
def verify_password(p,h): return pwd.verify(p,h)
def create_token(user):
    exp=datetime.now(timezone.utc)+timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    return jwt.encode({'sub':str(user.id),'role':user.role,'exp':exp},settings.JWT_SECRET_KEY,algorithm='HS256')
def current_user(token:str=Depends(oauth),db:Session=Depends(get_db)):
    try:
        data=jwt.decode(token,settings.JWT_SECRET_KEY,algorithms=['HS256']); uid=int(data['sub'])
    except (JWTError,KeyError,ValueError): raise HTTPException(status_code=401,detail='Invalid authentication token')
    user=db.get(User,uid)
    if not user or not user.is_active: raise HTTPException(status_code=401,detail='Inactive user')
    return user
def require_roles(*roles):
    def dep(user=Depends(current_user)):
        if user.role not in roles: raise HTTPException(status_code=403,detail='Insufficient permissions')
        return user
    return dep
