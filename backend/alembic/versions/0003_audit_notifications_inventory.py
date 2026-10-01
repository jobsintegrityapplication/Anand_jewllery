from alembic import op
import sqlalchemy as sa
revision='0003_inventory_notifications'; down_revision='0002_products_order_items'; branch_labels=None; depends_on=None
def upgrade():
    op.create_table('audit_logs',
        sa.Column('id',sa.Integer,primary_key=True),
        sa.Column('event_type',sa.String(60),nullable=False),
        sa.Column('entity',sa.String(40),nullable=False),
        sa.Column('entity_id',sa.Integer),
        sa.Column('order_id',sa.Integer,sa.ForeignKey('orders.id'),nullable=True),
        sa.Column('user_id',sa.Integer,sa.ForeignKey('users.id'),nullable=True),
        sa.Column('meta',sa.JSON),
        sa.Column('created_at',sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False))
    op.create_index('ix_audit_logs_event_type','audit_logs',['event_type'])
    op.create_index('ix_audit_logs_entity','audit_logs',['entity'])
    op.create_index('ix_audit_logs_entity_id','audit_logs',['entity_id'])
    op.create_index('ix_audit_logs_order_id','audit_logs',['order_id'])
    op.create_index('ix_audit_logs_created_at','audit_logs',['created_at'])

    op.add_column('customers',sa.Column('email',sa.String(150),nullable=True))
    op.add_column('customers',sa.Column('address',sa.Text,nullable=True))
    op.create_index('ix_customers_name','customers',['name'])

    op.add_column('notifications',sa.Column('order_id',sa.Integer,sa.ForeignKey('orders.id'),nullable=True))
    op.add_column('notifications',sa.Column('type',sa.String(60),nullable=True))
    op.add_column('notifications',sa.Column('message',sa.Text,nullable=True))
    op.add_column('notifications',sa.Column('retry_count',sa.Integer,nullable=False,server_default='0'))
    op.alter_column('notifications','order_item_id',existing_type=sa.Integer(),nullable=True)
    op.create_index('ix_notifications_customer_id','notifications',['customer_id'])
    op.create_index('ix_notifications_order_id','notifications',['order_id'])
    op.create_index('ix_notifications_order_item_id','notifications',['order_item_id'])
    op.create_index('ix_notifications_status','notifications',['status'])
    op.create_index('ix_notifications_created_at','notifications',['created_at'])

    op.add_column('products',sa.Column('reserved_quantity',sa.Integer,nullable=False,server_default='0'))

    op.add_column('order_items',sa.Column('expected_date',sa.Date,nullable=True))
    op.add_column('order_items',sa.Column('estimated_value',sa.Numeric(12,2),nullable=True))
    op.add_column('order_items',sa.Column('ready_at',sa.DateTime(timezone=True),nullable=True))
    op.create_index('ix_orders_status','orders',['status'])
    op.create_index('ix_orders_customer_id','orders',['customer_id'])
    op.create_index('ix_order_items_status','order_items',['status'])

    # Convert pre-existing direct stock consumption into the reservation model:
    # restore consumed stock into products.quantity, then reserve it on the
    # non-terminal order items so delivery consumes it exactly once.
    op.execute("""
        UPDATE products p SET quantity = p.quantity + s.total
        FROM (SELECT product_id, SUM(quantity) AS total FROM order_items
              WHERE product_id IS NOT NULL AND status NOT IN ('DELIVERED','CANCELLED')
              GROUP BY product_id) s
        WHERE s.product_id = p.id
    """)
    op.execute("""
        UPDATE products p SET reserved_quantity = s.total
        FROM (SELECT product_id, SUM(quantity) AS total FROM order_items
              WHERE product_id IS NOT NULL AND status NOT IN ('DELIVERED','CANCELLED')
              GROUP BY product_id) s
        WHERE s.product_id = p.id
    """)
def downgrade():
    op.drop_index('ix_order_items_status','order_items')
    op.drop_index('ix_orders_customer_id','orders')
    op.drop_index('ix_orders_status','orders')
    op.drop_column('order_items','ready_at')
    op.drop_column('order_items','estimated_value')
    op.drop_column('order_items','expected_date')
    op.drop_column('products','reserved_quantity')
    op.drop_index('ix_notifications_created_at','notifications')
    op.drop_index('ix_notifications_status','notifications')
    op.drop_index('ix_notifications_order_item_id','notifications')
    op.drop_index('ix_notifications_order_id','notifications')
    op.drop_index('ix_notifications_customer_id','notifications')
    op.drop_column('notifications','retry_count')
    op.drop_column('notifications','message')
    op.drop_column('notifications','type')
    op.drop_column('notifications','order_id')
    op.drop_index('ix_customers_name','customers')
    op.drop_column('customers','address')
    op.drop_column('customers','email')
    op.drop_index('ix_audit_logs_created_at','audit_logs')
    op.drop_index('ix_audit_logs_order_id','audit_logs')
    op.drop_index('ix_audit_logs_entity_id','audit_logs')
    op.drop_index('ix_audit_logs_entity','audit_logs')
    op.drop_index('ix_audit_logs_event_type','audit_logs')
    op.drop_table('audit_logs')
