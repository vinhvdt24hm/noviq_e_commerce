"""Add independent stores and seller-specific orders.

Revision ID: 20261114_multi_store
Revises: 20261113_product_images
Create Date: 2026-11-14
"""
from alembic import op
import sqlalchemy as sa


revision = "20261114_multi_store"
down_revision = "20261113_product_images"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    sellers = connection.execute(
        sa.text(
            "SELECT user_id, full_name, email "
            "FROM users WHERE role = 'seller' ORDER BY user_id"
        )
    ).mappings().all()
    product_count = connection.execute(
        sa.text("SELECT COUNT(*) FROM products")
    ).scalar_one()
    order_count = connection.execute(
        sa.text("SELECT COUNT(*) FROM orders")
    ).scalar_one()

    if (product_count or order_count) and len(sellers) != 1:
        raise RuntimeError(
            "Cannot assign legacy products and orders unambiguously: "
            "the database must contain exactly one seller account."
        )

    op.create_table(
        "stores",
        sa.Column("store_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("slug", sa.String(length=180), nullable=False),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["owner_user_id"],
            ["users.user_id"],
            name="fk_stores_owner_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("store_id"),
        sa.UniqueConstraint("owner_user_id", name="uq_stores_owner_user_id"),
        sa.UniqueConstraint("slug", name="uq_stores_slug"),
    )
    with op.batch_alter_table("products") as batch_op:
        batch_op.add_column(sa.Column("store_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_products_store_id_stores",
            "stores",
            ["store_id"],
            ["store_id"],
        )
    with op.batch_alter_table("orders") as batch_op:
        batch_op.add_column(sa.Column("store_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("checkout_id", sa.String(length=32), nullable=True))
        batch_op.create_foreign_key(
            "fk_orders_store_id_stores",
            "stores",
            ["store_id"],
            ["store_id"],
        )

    store_table = sa.table(
        "stores",
        sa.column("store_id", sa.Integer()),
        sa.column("owner_user_id", sa.Integer()),
        sa.column("name", sa.String(length=150)),
        sa.column("slug", sa.String(length=180)),
        sa.column("is_active", sa.Boolean()),
    )
    product_table = sa.table(
        "products",
        sa.column("store_id", sa.Integer()),
    )
    order_table = sa.table(
        "orders",
        sa.column("store_id", sa.Integer()),
        sa.column("checkout_id", sa.String(length=32)),
        sa.column("order_id", sa.Integer()),
        sa.column("order_number", sa.String(length=32)),
    )
    for seller in sellers:
        connection.execute(
            store_table.insert().values(
                owner_user_id=seller["user_id"],
                name=(seller["full_name"] or seller["email"])[:150],
                slug=f"store-{seller['user_id']}",
                is_active=True,
            )
        )
        store_id = connection.execute(
            sa.select(store_table.c.store_id).where(
                store_table.c.owner_user_id == seller["user_id"]
            )
        ).scalar_one()
        if len(sellers) == 1:
            connection.execute(
                product_table.update()
                .where(product_table.c.store_id.is_(None))
                .values(store_id=store_id)
            )
            connection.execute(
                order_table.update()
                .where(order_table.c.store_id.is_(None))
                .values(store_id=store_id, checkout_id=order_table.c.order_number)
            )

    with op.batch_alter_table("products") as batch_op:
        batch_op.alter_column(
            "store_id",
            existing_type=sa.Integer(),
            nullable=False,
        )
        batch_op.create_index("ix_products_store_id", ["store_id"], unique=False)
    with op.batch_alter_table("orders") as batch_op:
        batch_op.alter_column(
            "store_id",
            existing_type=sa.Integer(),
            nullable=False,
        )
        batch_op.alter_column(
            "checkout_id",
            existing_type=sa.String(length=32),
            nullable=False,
        )
        batch_op.create_index("ix_orders_store_id", ["store_id"], unique=False)
        batch_op.create_index("ix_orders_checkout_id", ["checkout_id"], unique=False)


def downgrade():
    with op.batch_alter_table("orders") as batch_op:
        batch_op.drop_index("ix_orders_checkout_id")
        batch_op.drop_index("ix_orders_store_id")
        batch_op.drop_constraint("fk_orders_store_id_stores", type_="foreignkey")
        batch_op.drop_column("checkout_id")
        batch_op.drop_column("store_id")
    with op.batch_alter_table("products") as batch_op:
        batch_op.drop_index("ix_products_store_id")
        batch_op.drop_constraint("fk_products_store_id_stores", type_="foreignkey")
        batch_op.drop_column("store_id")
    op.drop_table("stores")
