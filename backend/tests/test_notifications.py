from tests.conftest import make_user,login

def headers(client,db): 
    make_user(db); return login(client,'admin','Test_1234!')

def make_customer(client,h,opt_in,name='Ravi Kumar',phone='+919810011111'):
    cid=client.post('/api/customers',json={'name':name,'phone':phone},headers=h).json()['id']
    if opt_in: client.patch(f'/api/customers/{cid}',json={'whatsapp_opt_in':True},headers=h)
    return cid

def make_order(client,h,cid):
    return client.post('/api/orders',json={'customer_id':cid},headers=h).json()['id']

def test_custom_notification_requires_opt_in(client,db):
    h=headers(client,db)
    cid=make_customer(client,h,opt_in=False)
    r=client.post('/api/notifications',json={'customer_id':cid,'message':'Hello from Anand Jewellers'},headers=h)
    assert r.status_code==409

def test_custom_notification_queued(client,db):
    h=headers(client,db)
    cid=make_customer(client,h,opt_in=True)
    oid=make_order(client,h,cid)
    r=client.post('/api/notifications',json={'customer_id':cid,'order_id':oid,'message':'Your order is delayed by 2 days'},headers=h)
    assert r.status_code==200, r.text
    body=r.json()
    assert body['status']=='QUEUED' and body['type']=='CUSTOM'

def test_notification_filters(client,db):
    h=headers(client,db)
    cid=make_customer(client,h,opt_in=True)
    oid=make_order(client,h,cid)
    client.post('/api/notifications',json={'customer_id':cid,'order_id':oid,'message':'Custom message'},headers=h)
    r=client.get('/api/notifications',params={'status':'QUEUED'},headers=h)
    assert len(r.json())==1
    r=client.get('/api/notifications',params={'status':'SENT'},headers=h)
    assert r.json()==[]
    r=client.get('/api/notifications',params={'order_id':oid},headers=h)
    assert len(r.json())==1
    assert r.headers.get('X-Total-Count')=='1'

def test_retry_is_idempotent(client,db):
    h=headers(client,db)
    cid=make_customer(client,h,opt_in=True)
    client.post('/api/notifications',json={'customer_id':cid,'message':'Retry me'},headers=h)
    nid=client.get('/api/notifications',headers=h).json()[0]['id']
    r=client.post(f'/api/notifications/{nid}/retry',headers=h)
    assert r.status_code==409

def test_audit_requires_admin(client,db):
    make_user(db,username='staff',role='STAFF')
    sh=login(client,'staff','Test_1234!')
    r=client.get('/api/audit',headers=sh)
    assert r.status_code==403

def test_audit_records_actions(client,db):
    h=headers(client,db)
    make_customer(client,h,opt_in=True)
    r=client.get('/api/audit',headers=h)
    assert r.status_code==200
    events=[a['event_type'] for a in r.json()]
    assert 'customer_created' in events
    assert 'customer_updated' in events
