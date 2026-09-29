from tests.conftest import make_user,login

def headers(client,db): 
    make_user(db); return login(client,'admin','Test_1234!')

def test_create_and_get_customer(client,db):
    h=headers(client,db)
    r=client.post('/api/customers',json={'name':'Ravi Kumar','phone':'+919810011111'},headers=h)
    assert r.status_code==200, r.text
    cid=r.json()['id']
    r=client.get(f'/api/customers/{cid}',headers=h)
    assert r.status_code==200
    assert r.json()['name']=='Ravi Kumar'

def test_duplicate_phone_rejected(client,db):
    h=headers(client,db)
    client.post('/api/customers',json={'name':'Ravi Kumar','phone':'+919810011111'},headers=h)
    r=client.post('/api/customers',json={'name':'Other Person','phone':'+919810011111'},headers=h)
    assert r.status_code==409

def test_invalid_phone_rejected(client,db):
    h=headers(client,db)
    r=client.post('/api/customers',json={'name':'Ravi Kumar','phone':'not-a-phone'},headers=h)
    assert r.status_code==422

def test_search_by_name_and_phone(client,db):
    h=headers(client,db)
    client.post('/api/customers',json={'name':'Ravi Kumar','phone':'+919810011111'},headers=h)
    client.post('/api/customers',json={'name':'Meena Iyer','phone':'+919810022222'},headers=h)
    r=client.get('/api/customers',params={'q':'Ravi'},headers=h)
    assert [c['name'] for c in r.json()]==['Ravi Kumar']
    r=client.get('/api/customers',params={'q':'22222'},headers=h)
    assert [c['name'] for c in r.json()]==['Meena Iyer']
    r=client.get('/api/customers',headers=h)
    assert r.headers.get('X-Total-Count')=='2'

def test_update_customer(client,db):
    h=headers(client,db)
    cid=client.post('/api/customers',json={'name':'Ravi Kumar','phone':'+919810011111'},headers=h).json()['id']
    r=client.patch(f'/api/customers/{cid}',json={'whatsapp_opt_in':True,'notes':'VIP'},headers=h)
    assert r.status_code==200
    assert r.json()['whatsapp_opt_in'] is True

def test_delete_blocked_when_orders_exist(client,db):
    h=headers(client,db)
    cid=client.post('/api/customers',json={'name':'Ravi Kumar','phone':'+919810011111'},headers=h).json()['id']
    client.post('/api/orders',json={'customer_id':cid},headers=h)
    r=client.delete(f'/api/customers/{cid}',headers=h)
    assert r.status_code==409

def test_delete_customer(client,db):
    h=headers(client,db)
    cid=client.post('/api/customers',json={'name':'Ravi Kumar','phone':'+919810011111'},headers=h).json()['id']
    r=client.delete(f'/api/customers/{cid}',headers=h)
    assert r.status_code==200
    assert client.get(f'/api/customers/{cid}',headers=h).status_code==404
