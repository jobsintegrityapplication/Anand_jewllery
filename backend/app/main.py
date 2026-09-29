from collections import deque
import time
from fastapi import FastAPI,Request,Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.api import auth,customers,orders,products,dashboard,notifications,reports,audit,users
from app.core.security import current_user
app=FastAPI(title='Anand Jewellers API',version='1.2.0',docs_url='/api/docs',openapi_url='/api/openapi.json')
origins=[x.strip() for x in settings.CORS_ORIGINS.split(',') if x.strip()]
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_credentials=True,allow_methods=['*'],allow_headers=['*'])
app.include_router(auth.router,prefix='/api')
app.include_router(customers.router,prefix='/api')
app.include_router(orders.router,prefix='/api')
app.include_router(products.router,prefix='/api')
app.include_router(dashboard.router,prefix='/api')
app.include_router(notifications.router,prefix='/api')
app.include_router(reports.router,prefix='/api')
app.include_router(audit.router,prefix='/api')
app.include_router(users.router,prefix='/api')
_login_attempts:dict[str,deque]= {}
LOGIN_RATE_LIMIT=10
LOGIN_RATE_WINDOW=60
@app.middleware('http')
async def rate_limit_login(request:Request,call_next):
    if request.url.path=='/api/auth/login' and request.method=='POST':
        ip=request.client.host if request.client else 'unknown'
        now=time.time()
        attempts=_login_attempts.setdefault(ip,deque())
        while attempts and now-attempts[0]>LOGIN_RATE_WINDOW: attempts.popleft()
        if len(attempts)>=LOGIN_RATE_LIMIT:
            # Middleware runs outside the exception handlers, so the 429 must be
            # returned directly rather than raised.
            return JSONResponse(status_code=429,content={'detail':'Too many login attempts, try again later'})
        attempts.append(now)
    return await call_next(request)
@app.get('/api/health')
def health(): return {'status':'ok'}
@app.get('/api/settings')
def settings_status(_=Depends(current_user)):
    return {
        'whatsapp_enabled':settings.WHATSAPP_ENABLED,
        'whatsapp_configured':bool(settings.WHATSAPP_ENABLED and settings.WHATSAPP_ACCESS_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID),
        's3_configured':bool(settings.S3_ENDPOINT_URL and settings.S3_ACCESS_KEY and settings.S3_SECRET_KEY),
        'app_public_url':settings.APP_PUBLIC_URL,
    }
