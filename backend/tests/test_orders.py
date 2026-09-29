from tests.conftest import make_user,login
from app.models.product import Product

def headers(client,db): 
    make_user(db); return login(client,'admin','Test_1234!')

def make_customer(client,h,name='Ravi Kumar',phone='+919810011111'):
    return client.post('/api/customers',json={'name':name,'phone':phone},headers=h).json()['id']

def make_product(db,sku='GOLD-RING-001',quantity=10):
    p=Product(sku=sku,name='Gold Ring',category='GOLD',quantity=quantity,min_quantity=2)
    db.add(p); db.commit(); db.refresh(p)
    return p

def test_create_order_with_items_reserves_stock(client,db):
    h=headers(client,db)
    cid=make_customer(client,h)
    p=make_product(db,quantity=10)
    r=client.post('/api/orders',json={'customer_id':cid,'items':[{'item_type':'Ring','quantity':4,'product_id':p.id}]},headers=h)
    assert r.status_code==200, r.text
    order=r.json()
    assert order['order_number'].startswith('ANJ-')
    assert len(order['items'])==1
    assert order['items'][0]['status']=='ORDER_CREATED'
    prod=client.get(f"/api/products/{p.id}",headers=h).json()
    assert prod['quantity']==10 and prod['reserved_quantity']==4
    assert prod['available_quantity']==6

def test_create_order_unknown_customer(client,db):
    h=headers(client,db)
    r=client.post('/api/orders',json={'customer_id':999},headers=h)
    assert r.status_code==404

def test_insufficient_stock_rejected(client,db):
    h=headers(client,db)
    cid=make_customer(client,h)
    p=make_product(db,quantity=2)
    r=client.post('/api/orders',json={'customer_id':cid,'items':[{'item_type':'Ring','quantity':5,'product_id':p.id}]},headers=h)
    assert r.status_code==409

def test_order_status_transition_rules(client,db):
    h=headers(client,db)
    cid=make_customer(client,h)
    oid=client.post('/api/orders',json={'customer_id':cid},headers=h).json()['id']
    r=client.patch(f'/api/orders/{oid}',json={'status':'DELIVERED'},headers=h)
    assert r.status_code==200
    r=client.patch(f'/api/orders/{oid}',json={'status':'OPEN'},headers=h)
    assert r.status_code==400
    r=client.patch(f'/api/orders/{oid}',json={'status':'NOT_A_STATUS'},headers=h)
    assert r.status_code==400

def test_item_status_flow_updates_order_and_ready_at(client,db):
    h=headers(client,db)
    cid=make_customer(client,h,'Opt In User','+919810033333')
    client.patch(f"/api/customers/{cid}",json={'whatsapp_opt_in':True},headers=h)
    oid=client.post('/api/orders',json={'customer_id':cid},headers=h).json()['id']
    order=client.post(f'/api/orders/{oid}/items',json={'item_type':'Ring','quantity':1},headers=h).json()
    item_id=order['items'][0]['id']
    r=client.patch(f'/api/orders/items/{item_id}/status',json={'status':'IN_PROGRESS'},headers=h)
    assert r.status_code==200
    r=client.patch(f'/api/orders/items/{item_id}/status',json={'status':'READY'},headers=h)
    assert r.status_code==200, r.text
    body=r.json()
    assert body['status']=='READY'
    assert body['items'][0]['ready_at'] is not None
    notifs=client.get('/api/notifications',params={'order_id':oid},headers=h).json()
    assert len(notifs)==1 and notifs[0]['type']=='ORDER_READY' and notifs[0]['status']=='QUEUED'

def test_invalid_item_transition_rejected(client,db):
    h=headers(client,db)
    cid=make_customer(client,h)
    oid=client.post('/api/orders',json={'customer_id':cid},headers=h).json()['id']
    item=client.post(f'/api/orders/{oid}/items',json={'item_type':'Ring'},headers=h).json()['items'][0]
    r=client.patch(f"/api/orders/items/{item['id']}/status",json={'status':'DELIVERED'},headers=h)
    assert r.status_code==400

def test_delivery_consumes_reserved_stock(client,db):
    h=headers(client,db)
    cid=make_customer(client,h)
    p=make_product(db,quantity=10)
    order=client.post('/api/orders',json={'customer_id':cid,'items':[{'item_type':'Ring','quantity':4,'product_id':p.id}]},headers=h).json()
    item_id=order['items'][0]['id']
    client.patch(f'/api/orders/items/{item_id}/status',json={'status':'IN_PROGRESS'},headers=h)
    r=client.patch(f'/api/orders/items/{item_id}/status',json={'status':'READY'},headers=h)
    assert r.status_code==200
    r=client.patch(f'/api/orders/items/{item_id}/status',json={'status':'DELIVERED'},headers=h)
    assert r.status_code==200
    prod=client.get(f"/api/products/{p.id}",headers=h).json()
    assert prod['quantity']==6 and prod['reserved_quantity']==0

def test_cancellation_releases_reservation(client,db):
    h=headers(client,db)
    cid=make_customer(client,h)
    p=make_product(db,quantity=10)
    order=client.post('/api/orders',json={'customer_id':cid,'items':[{'item_type':'Ring','quantity':4,'product_id':p.id}]},headers=h).json()
    item_id=order['items'][0]['id']
    client.patch(f'/api/orders/items/{item_id}/status',json={'status':'IN_PROGRESS'},headers=h)
    r=client.patch(f'/api/orders/items/{item_id}/status',json={'status':'CANCELLED'},headers=h)
    assert r.status_code==200
    prod=client.get(f"/api/products/{p.id}",headers=h).json()
    assert prod['quantity']==10 and prod['reserved_quantity']==0

def test_order_search_and_filters(client,db):
    h=headers(client,db)
    cid=make_customer(client,h,'Ravi Kumar','+919810011111')
    client.post('/api/orders',json={'customer_id':cid},headers=h)
    r=client.get('/api/orders',params={'q':'Ravi'},headers=h)
    assert r.status_code==200 and len(r.json())==1
    r=client.get('/api/orders',params={'status':'OPEN'},headers=h)
    assert len(r.json())==1
    r=client.get('/api/orders',params={'status':'DELIVERED'},headers=h)
    assert len(r.json())==0
    r=client.get('/api/orders',headers=h)
    assert r.headers.get('X-Total-Count')=='1'

def test_order_timeline(client,db):
    h=headers(client,db)
    cid=make_customer(client,h)
    oid=client.post('/api/orders',json={'customer_id':cid},headers=h).json()['id']
    r=client.get(f'/api/orders/{oid}/timeline',headers=h)
    assert r.status_code==200
    events=[e['event_type'] for e in r.json()]
    assert 'order_created' in events
