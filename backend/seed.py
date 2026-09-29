from datetime import datetime,timedelta,timezone
from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import hash_password
from app.models import *

# Development/demo seed data only — all customer names are fictional.
db=SessionLocal()

def seeded():
    return db.query(Customer).count()>0

if not db.query(User).filter(User.username=='admin').first():
    db.add(User(username='admin',password_hash=hash_password('ChangeMe_123!'),role='ADMIN'))
    db.commit()
if not db.query(User).filter(User.username=='staff').first():
    db.add(User(username='staff',password_hash=hash_password('Staff_123!'),role='STAFF'))
    db.commit()

if not seeded():
    now=datetime.now(timezone.utc)
    customers=[
        Customer(name='Rahul Sharma',phone='+919810000001',email='rahul.sharma@example.com',address='12 MG Road, Jaipur',whatsapp_opt_in=True,notes='Prefers evening calls'),
        Customer(name='Priya Patel',phone='+919810000002',email='priya.patel@example.com',address='44 Station Road, Surat',whatsapp_opt_in=True),
        Customer(name='Amit Verma',phone='+919810000003',email='amit.verma@example.com',address='7 Bazaar Street, Delhi',whatsapp_opt_in=False),
        Customer(name='Sunita Desai',phone='+919810000004',email='sunita.desai@example.com',address='23 Lake View, Pune',whatsapp_opt_in=True,notes='Repeat customer'),
        Customer(name='Vikram Rao',phone='+919810000005',email='vikram.rao@example.com',address='9 Temple Lane, Hyderabad',whatsapp_opt_in=False),
    ]
    db.add_all(customers); db.commit()

    products=[
        Product(sku='GOLD-RING-001',name='Gold Ring 22K Plain',category='GOLD',description='Plain 22K gold ring',unit_weight_g=5.5,price=32500,quantity=10,reserved_quantity=2,min_quantity=3),
        Product(sku='GOLD-CHAIN-001',name='Gold Chain 22K Rope',category='GOLD',description='22K rope chain 20 inch',unit_weight_g=12.8,price=72000,quantity=6,reserved_quantity=1,min_quantity=2),
        Product(sku='DIAMOND-RING-001',name='Diamond Solitaire Ring',category='DIAMOND',description='0.5ct solitaire in 18K',unit_weight_g=3.2,price=145000,quantity=3,reserved_quantity=1,min_quantity=2),
        Product(sku='SILVER-BANGLE-001',name='Silver Bangle Pair',category='SILVER',description='Oxidised silver bangles',unit_weight_g=28.0,price=4200,quantity=2,reserved_quantity=0,min_quantity=4),
        Product(sku='GOLD-EARRING-001',name='Gold Jhumka Earrings',category='GOLD',description='Traditional jhumka 22K',unit_weight_g=8.4,price=48900,quantity=0,reserved_quantity=0,min_quantity=2),
        Product(sku='GOLD-PENDANT-001',name='Gold Pendant Lakshmi',category='GOLD',description='Lakshmi pendant 22K',unit_weight_g=4.1,price=25600,quantity=8,reserved_quantity=1,min_quantity=2),
    ]
    db.add_all(products); db.commit()

    def make_order(number,customer,days_ago,expected_days,status,notes=None):
        return Order(order_number=number,customer_id=customer.id,status=status,notes=notes,
                     created_at=now-timedelta(days=days_ago),
                     expected_delivery_date=(now+timedelta(days=expected_days)).date() if expected_days is not None else None)

    orders=[
        make_order('ANJ-DEMO-0001',customers[0],10,3,'IN_PROGRESS','Engagement set for nephew'),
        make_order('ANJ-DEMO-0002',customers[1],8,5,'OPEN',None),
        make_order('ANJ-DEMO-0003',customers[3],15,-2,'READY','Anniversary gift'),
        make_order('ANJ-DEMO-0004',customers[3],25,-10,'DELIVERED',None),
        make_order('ANJ-DEMO-0005',customers[2],4,7,'OPEN','Bulk bangles for family function'),
    ]
    db.add_all(orders); db.commit()

    items=[
        OrderItem(order_id=orders[0].id,item_code='ANJ-DEMO-0001-ITEM-00001',item_type='Diamond Ring',description='Solitaire sizing to size 12',quantity=1,status='IN_PROGRESS',product_id=products[2].id,expected_date=(now+timedelta(days=3)).date(),estimated_value=145000,workshop_notes='Resize + polish'),
        OrderItem(order_id=orders[0].id,item_code='ANJ-DEMO-0001-ITEM-00002',item_type='Chain',description='Rope chain lengthening',quantity=1,status='READY',product_id=products[1].id,expected_date=(now+timedelta(days=2)).date(),estimated_value=72000,ready_at=now-timedelta(days=1)),
        OrderItem(order_id=orders[1].id,item_code='ANJ-DEMO-0002-ITEM-00001',item_type='Ring',description='Gold ring 22K, size 16',quantity=2,status='ORDER_CREATED',product_id=products[0].id,expected_date=(now+timedelta(days=5)).date(),estimated_value=65000),
        OrderItem(order_id=orders[2].id,item_code='ANJ-DEMO-0003-ITEM-00001',item_type='Pendant',description='Lakshmi pendant',quantity=1,status='READY',product_id=products[5].id,expected_date=(now-timedelta(days=2)).date(),estimated_value=25600,ready_at=now-timedelta(days=3)),
        OrderItem(order_id=orders[3].id,item_code='ANJ-DEMO-0004-ITEM-00001',item_type='Earring',description='Jhumka pair',quantity=1,status='DELIVERED',expected_date=(now-timedelta(days=10)).date(),estimated_value=48900,ready_at=now-timedelta(days=12)),
        OrderItem(order_id=orders[4].id,item_code='ANJ-DEMO-0005-ITEM-00001',item_type='Bangle',description='Oxidised bangles, 6 pairs',quantity=6,status='ORDER_CREATED',expected_date=(now+timedelta(days=7)).date(),estimated_value=25200),
    ]
    db.add_all(items); db.commit()

    notifications=[
        Notification(customer_id=customers[3].id,order_id=orders[2].id,order_item_id=items[3].id,channel='WHATSAPP',type='ORDER_READY',message='Dear Sunita Desai, your Anand Jewellers order ANJ-DEMO-0003 is ready for collection. Please contact us if you need any assistance.',status='SENT',provider_message_id='demo-msg-0001',created_at=now-timedelta(days=3),sent_at=now-timedelta(days=3)+timedelta(minutes=2)),
        Notification(customer_id=customers[3].id,order_id=orders[3].id,order_item_id=items[4].id,channel='WHATSAPP',type='ORDER_DELIVERED',message='Thank you Sunita Desai for choosing Anand Jewellers. Order ANJ-DEMO-0004 has been marked as delivered.',status='SENT',provider_message_id='demo-msg-0002',created_at=now-timedelta(days=10),sent_at=now-timedelta(days=10)+timedelta(minutes=1)),
        Notification(customer_id=customers[0].id,order_id=orders[0].id,order_item_id=items[1].id,channel='WHATSAPP',type='ORDER_READY',message='Dear Rahul Sharma, your Anand Jewellers order ANJ-DEMO-0001 is ready for collection. Please contact us if you need any assistance.',status='QUEUED',created_at=now-timedelta(hours=5)),
        Notification(customer_id=customers[1].id,order_id=orders[1].id,order_item_id=items[2].id,channel='WHATSAPP',type='ORDER_CREATED',message='Dear Priya Patel, your order ANJ-DEMO-0002 has been received by Anand Jewellers. Thank you for choosing us.',status='FAILED',error='WhatsApp provider rejected the template (demo failure)',retry_count=2,created_at=now-timedelta(days=8)),
    ]
    db.add_all(notifications); db.commit()
    print('demo seed complete')
else:
    print('seed complete')
