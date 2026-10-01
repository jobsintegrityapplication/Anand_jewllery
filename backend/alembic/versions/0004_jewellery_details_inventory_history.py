from alembic import op
import sqlalchemy as sa

revision = '0004_jewellery_details'
down_revision = '0003_inventory_notifications'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('order_items', sa.Column('design', sa.Text(), nullable=True))
    op.add_column('order_items', sa.Column('gold_rate', sa.Numeric(12, 2), nullable=True))
    op.add_column('order_items', sa.Column('gold_purity', sa.String(24), nullable=True))
    op.add_column('order_items', sa.Column('net_weight_g', sa.Numeric(12, 3), nullable=True))
    op.add_column('order_items', sa.Column('count', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('order_items', sa.Column('making_charges', sa.Numeric(12, 2), nullable=True))
    op.add_column('order_items', sa.Column('wastage_percent', sa.Numeric(6, 3), nullable=True))
    op.add_column('order_items', sa.Column('other_charges', sa.Numeric(12, 2), nullable=True))
    op.add_column('order_items', sa.Column('cancellation_reason', sa.Text(), nullable=True))

    op.alter_column('products', 'quantity', existing_type=sa.Integer(), type_=sa.Numeric(12, 3), existing_nullable=False, postgresql_using='quantity::numeric')
    op.alter_column('products', 'reserved_quantity', existing_type=sa.Integer(), type_=sa.Numeric(12, 3), existing_nullable=False, postgresql_using='reserved_quantity::numeric')
    op.alter_column('products', 'min_quantity', existing_type=sa.Integer(), type_=sa.Numeric(12, 3), existing_nullable=False, postgresql_using='min_quantity::numeric')
    op.add_column('products', sa.Column('unit', sa.String(12), nullable=False, server_default='pcs'))
    op.add_column('products', sa.Column('purity', sa.String(24), nullable=True))

    op.create_table(
        'inventory_transactions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id'), nullable=False),
        sa.Column('transaction_type', sa.String(20), nullable=False),
        sa.Column('quantity_delta', sa.Numeric(12, 3), nullable=False, server_default='0'),
        sa.Column('reserved_delta', sa.Numeric(12, 3), nullable=False, server_default='0'),
        sa.Column('balance_after', sa.Numeric(12, 3), nullable=False),
        sa.Column('unit', sa.String(12), nullable=False, server_default='pcs'),
        sa.Column('reference', sa.String(160), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('orders.id', ondelete='SET NULL'), nullable=True),
        sa.Column('order_item_id', sa.Integer(), sa.ForeignKey('order_items.id', ondelete='SET NULL'), nullable=True),
        sa.Column('reversal_of_id', sa.Integer(), sa.ForeignKey('inventory_transactions.id'), nullable=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_inventory_transactions_product_id', 'inventory_transactions', ['product_id'])
    op.create_index('ix_inventory_transactions_transaction_type', 'inventory_transactions', ['transaction_type'])
    op.create_index('ix_inventory_transactions_created_at', 'inventory_transactions', ['created_at'])
    op.create_index('ix_inventory_transactions_order_id', 'inventory_transactions', ['order_id'])
    op.create_index('ix_inventory_transactions_order_item_id', 'inventory_transactions', ['order_item_id'])
    op.create_index('ix_inventory_transactions_reversal_of_id', 'inventory_transactions', ['reversal_of_id'], unique=True)
    op.execute("""
        INSERT INTO inventory_transactions
            (product_id, transaction_type, quantity_delta, reserved_delta, balance_after, unit, reference, reason)
        SELECT id, 'OPENING', quantity, reserved_quantity, quantity, unit, 'Migration 0004', 'Opening balance captured when inventory history was introduced'
        FROM products
    """)


def downgrade():
    op.drop_index('ix_inventory_transactions_reversal_of_id', 'inventory_transactions')
    op.drop_table('inventory_transactions')
    op.drop_column('products', 'purity')
    op.drop_column('products', 'unit')
    op.alter_column('products', 'min_quantity', existing_type=sa.Numeric(12, 3), type_=sa.Integer(), existing_nullable=False, postgresql_using='round(min_quantity)::integer')
    op.alter_column('products', 'reserved_quantity', existing_type=sa.Numeric(12, 3), type_=sa.Integer(), existing_nullable=False, postgresql_using='round(reserved_quantity)::integer')
    op.alter_column('products', 'quantity', existing_type=sa.Numeric(12, 3), type_=sa.Integer(), existing_nullable=False, postgresql_using='round(quantity)::integer')
    for column in ('cancellation_reason', 'other_charges', 'wastage_percent', 'making_charges', 'count', 'net_weight_g', 'gold_purity', 'gold_rate', 'design'):
        op.drop_column('order_items', column)
