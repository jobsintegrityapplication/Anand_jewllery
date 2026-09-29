from fastapi import APIRouter,Depends,HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest,TokenResponse
from app.core.security import verify_password,create_token
router=APIRouter(prefix='/auth',tags=['auth'])
@router.post('/login',response_model=TokenResponse,summary='Login with username and password, returns a JWT bearer token')
def login(req:LoginRequest,db:Session=Depends(get_db)):
    u=db.query(User).filter(User.username==req.username).first()
    if not u or not verify_password(req.password,u.password_hash): raise HTTPException(status_code=401,detail='Invalid username or password')
    return TokenResponse(access_token=create_token(u))
