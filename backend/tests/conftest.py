import os
# Required settings must exist before app modules are imported.
os.environ.setdefault('DATABASE_URL','sqlite://')
os.environ.setdefault('JWT_SECRET_KEY','test-secret-key')
os.environ.setdefault('S3_ENDPOINT_URL','http://localhost:9000')
os.environ.setdefault('S3_ACCESS_KEY','test-access')
os.environ.setdefault('S3_SECRET_KEY','test-secret')
os.environ.setdefault('WHATSAPP_ENABLED','false')

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import User
from app.core.security import hash_password

engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
TestingSessionLocal=sessionmaker(bind=engine,autocommit=False,autoflush=False)

@pytest.fixture(autouse=True)
def stub_celery(monkeypatch):
    monkeypatch.setattr('app.tasks.celery_app.send_whatsapp_task.delay',lambda *a,**k: None)

@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    session=TestingSessionLocal()
    app.dependency_overrides[get_db]=lambda: session
    from app import main as app_main
    app_main._login_attempts.clear()
    try: yield session
    finally:
        session.close()
        app.dependency_overrides.pop(get_db,None)
        Base.metadata.drop_all(bind=engine)

@pytest.fixture()
def client(db):
    with TestClient(app) as c: yield c

def make_user(db,username='admin',password='Test_1234!',role='ADMIN'):
    u=User(username=username,password_hash=hash_password(password),role=role)
    db.add(u); db.commit(); db.refresh(u)
    return u,password

def login(client,username,password):
    r=client.post('/api/auth/login',json={'username':username,'password':password})
    assert r.status_code==200, r.text
    return {'Authorization':f"Bearer {r.json()['access_token']}"}
