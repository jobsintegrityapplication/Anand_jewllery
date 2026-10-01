from alembic import op
import sqlalchemy as sa

revision = "0006_order_payments_invoices"
down_revision = "0005_dashboard_month_snapshots"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("orders", sa.Column("invoice_number", sa.String(length=60), nullable=True))
    op.add_column("orders", sa.Column("invoice_issued_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_orders_invoice_number", "orders", ["invoice_number"], unique=True)
    op.create_table(
        "order_payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("method", sa.String(length=30), nullable=False),
        sa.Column("reference", sa.String(length=120), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("received_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_order_payments_order_id", "order_payments", ["order_id"])


def downgrade():
    op.drop_index("ix_order_payments_order_id", table_name="order_payments")
    op.drop_table("order_payments")
    op.drop_index("ix_orders_invoice_number", table_name="orders")
    op.drop_column("orders", "invoice_issued_at")
    op.drop_column("orders", "invoice_number")
