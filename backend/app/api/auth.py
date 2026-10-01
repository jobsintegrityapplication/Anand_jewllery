from fastapi import APIRouter,Depends,HTTPException,Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest,TokenResponse
from app.core.security import verify_password,create_token,current_user
from app.services.audit import record_audit
router=APIRouter(prefix='/auth',tags=['auth'])
@router.get('/me',summary='Return the signed-in staff profile')
def me(user=Depends(current_user)):
    return {'id':user.id,'username':user.username,'role':user.role}

@router.post('/login',response_model=TokenResponse,summary='Login with username and password, returns a JWT bearer token')
def login(req:LoginRequest,request:Request,db:Session=Depends(get_db)):
    u=db.query(User).filter(User.username==req.username).first()
    if not u or not u.is_active or not verify_password(req.password,u.password_hash): raise HTTPException(status_code=401,detail='Invalid username or password')
    agent=(request.headers.get('user-agent') or '').lower()
    browser='Edge' if 'edg/' in agent else 'Chrome' if 'chrome/' in agent else 'Firefox' if 'firefox/' in agent else 'Safari' if 'safari/' in agent else 'Other'
    record_audit(db,'access','session',user_id=u.id,meta={
        'username':u.username,
        'role':u.role,
        'browser':browser,
        'ip':request.client.host if request.client else None,
    })
    db.commit()
    return TokenResponse(access_token=create_token(u))
