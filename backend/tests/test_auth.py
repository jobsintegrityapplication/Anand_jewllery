from tests.conftest import make_user

def test_login_success(client,db):
    make_user(db)
    r=client.post('/api/auth/login',json={'username':'admin','password':'Test_1234!'})
    assert r.status_code==200
    body=r.json()
    assert body['access_token'] and body['token_type']=='bearer'

def test_login_wrong_password(client,db):
    make_user(db)
    r=client.post('/api/auth/login',json={'username':'admin','password':'wrong'})
    assert r.status_code==401

def test_login_unknown_user(client,db):
    r=client.post('/api/auth/login',json={'username':'ghost','password':'whatever'})
    assert r.status_code==401

def test_protected_route_requires_token(client,db):
    r=client.get('/api/customers')
    assert r.status_code==401

def test_invalid_token_rejected(client,db):
    r=client.get('/api/customers',headers={'Authorization':'Bearer not-a-token'})
    assert r.status_code==401

def test_health(client):
    r=client.get('/api/health')
    assert r.status_code==200
    assert r.json()['status']=='ok'
