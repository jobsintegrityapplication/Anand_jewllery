from tests.conftest import make_user,login
from app.models.product import Product

def admin_headers(client,db): 
    make_user(db); return login(client,'admin','Test_1234!')

def staff_headers(client,db): 
    make_user(db,username='staff',role='STAFF'); return login(client,'staff','Test_1234!')

def test_product_crud_and_search(client,db):
    h=admin_headers(client,db)
    r=client.post('/api/products',json={'sku':'GOLD-CHAIN-01','name':'Rope Chain','category':'GOLD','quantity':5},headers=h)
    assert r.status_code==200, r.text
    pid=r.json()['id']
    r=client.get('/api/products',params={'q':'chain'},headers=h)
    assert [p['sku'] for p in r.json()]==['GOLD-CHAIN-01']
    r=client.get('/api/products',params={'category':'silver'},headers=h)
    assert r.json()==[]
    r=client.post(f'/api/products/{pid}/stock/add',json={'quantity':3,'reason':'Received supplier stock'},headers=h)
    assert r.status_code==200 and r.json()['quantity']==8

def test_duplicate_sku_rejected(client,db):
    h=admin_headers(client,db)
    client.post('/api/products',json={'sku':'GOLD-CHAIN-01','name':'Rope Chain'},headers=h)
    r=client.post('/api/products',json={'sku':'GOLD-CHAIN-01','name':'Copy Chain'},headers=h)
    assert r.status_code==409

def test_low_stock_filter(client,db):
    h=admin_headers(client,db)
    db.add(Product(sku='LOW-001',name='Low Stock Item',category='GOLD',quantity=1,min_quantity=3)); db.commit()
    db.add(Product(sku='OK-001',name='Fine Item',category='GOLD',quantity=10,min_quantity=2)); db.commit()
    r=client.get('/api/products',params={'low_stock':'true'},headers=h)
    assert [p['sku'] for p in r.json()]==['LOW-001']

def test_adjust_stock(client,db):
    h=admin_headers(client,db)
    pid=client.post('/api/products',json={'sku':'ADJ-001','name':'Adjustable','quantity':5},headers=h).json()['id']
    r=client.post(f'/api/products/{pid}/adjust',json={'delta':-3,'reason':'Physical stock reconciliation'},headers=h)
    assert r.status_code==200 and r.json()['quantity']==2
    r=client.post(f'/api/products/{pid}/adjust',json={'delta':-10,'reason':'Physical stock reconciliation'},headers=h)
    assert r.status_code==409

def test_reserve_and_release_stock(client,db):
    h=admin_headers(client,db)
    pid=client.post('/api/products',json={'sku':'RES-001','name':'Reservable','quantity':5},headers=h).json()['id']
    r=client.post(f'/api/products/{pid}/reserve',json={'quantity':2},headers=h)
    assert r.status_code==200
    assert r.json()['available_quantity']==3
    r=client.post(f'/api/products/{pid}/reserve',json={'quantity':4},headers=h)
    assert r.status_code==409
    r=client.post(f'/api/products/{pid}/release',json={'quantity':1},headers=h)
    assert r.status_code==200
    assert r.json()['available_quantity']==4
    r=client.post(f'/api/products/{pid}/release',json={'quantity':5},headers=h)
    assert r.status_code==409

def test_delete_product_requires_admin(client,db):
    ah=admin_headers(client,db)
    sh=staff_headers(client,db)
    pid=client.post('/api/products',json={'sku':'DEL-001','name':'Protected','quantity':5},headers=ah).json()['id']
    r=client.delete(f'/api/products/{pid}',headers=sh)
    assert r.status_code==403
    r=client.delete(f'/api/products/{pid}',headers=ah)
    assert r.status_code==200
    prod=client.get(f'/api/products/{pid}',headers=ah).json()
    assert prod['is_active'] is False

def test_quantity_cannot_go_below_reserved(client,db):
    h=admin_headers(client,db)
    pid=client.post('/api/products',json={'sku':'RES-002','name':'Reserved','quantity':5},headers=h).json()['id']
    client.post(f'/api/products/{pid}/reserve',json={'quantity':3},headers=h)
    r=client.post(f'/api/products/{pid}/stock/remove',json={'quantity':4,'reason':'Test removal'},headers=h)
    assert r.status_code==409
