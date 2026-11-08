"""Add inventory and order records

Revision ID: 20261102_orders
Revises: 9f511dfe7fdc
Create Date: 2026-11-02
"""
from alembic import op
import sqlalchemy as sa


revision = "20261102_orders"
down_revision = "9f511dfe7fdc"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "products",
        sa.Column("stock", sa.Integer(), server_default="0", nullable=False),
    )
    op.create_table(
        "orders",
        sa.Column("order_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("order_number", sa.String(length=32), nullable=False),
        sa.Column("recipient_name", sa.String(length=255), nullable=False),
        sa.Column("phone_number", sa.String(length=20), nullable=False),
        sa.Column("shipping_address", sa.String(length=500), nullable=False),
        sa.Column("total_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default="pending",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("order_id"),
        sa.UniqueConstraint("order_number"),
    )
    op.create_index("ix_orders_user_id", "orders", ["user_id"], unique=False)
    op.create_table(
        "order_items",
        sa.Column("order_item_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=True),
        sa.Column("product_name", sa.String(length=150), nullable=False),
        sa.Column("image_url", sa.String(length=2048), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.ForeignKeyConstraint(
            ["order_id"], ["orders.order_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["product_id"], ["products.product_id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("order_item_id"),
    )


def downgrade():
    op.drop_table("order_items")
    op.drop_index("ix_orders_user_id", table_name="orders")
    op.drop_table("orders")
    op.drop_column("products", "stock")
