from alembic import op
import sqlalchemy as sa
revision='0002_products_order_items'; down_revision='0001_initial'; branch_labels=None; depends_on=None
def upgrade():
    op.create_table('products',
        sa.Column('id',sa.Integer,primary_key=True),
        sa.Column('sku',sa.String(60),unique=True,nullable=False),
        sa.Column('name',sa.String(150),nullable=False),
        sa.Column('category',sa.String(80),nullable=False),
        sa.Column('description',sa.Text),
        sa.Column('unit_weight_g',sa.Numeric(10,3)),
        sa.Column('price',sa.Numeric(12,2)),
        sa.Column('quantity',sa.Integer,nullable=False),
        sa.Column('min_quantity',sa.Integer,nullable=False),
        sa.Column('is_active',sa.Boolean,nullable=False),
        sa.Column('created_at',sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),
        sa.Column('updated_at',sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False))
    op.create_index('ix_products_name','products',['name'])
    op.create_index('ix_products_category','products',['category'])
    op.add_column('order_items',sa.Column('product_id',sa.Integer,sa.ForeignKey('products.id'),nullable=True))
    op.add_column('order_items',sa.Column('quantity',sa.Integer,nullable=False,server_default='1'))
def downgrade():
    op.drop_column('order_items','quantity')
    op.drop_column('order_items','product_id')
    op.drop_index('ix_products_category','products')
    op.drop_index('ix_products_name','products')
    op.drop_table('products')
