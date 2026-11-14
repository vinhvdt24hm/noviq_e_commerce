"""Add an ordered image gallery to products.

Revision ID: 20261113_product_images
Revises: 20261103_repair_tables
Create Date: 2026-11-13
"""
from alembic import op
import sqlalchemy as sa


revision = "20261113_product_images"
down_revision = "20261103_repair_tables"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "product_images",
        sa.Column("product_image_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("image_url", sa.String(length=2048), nullable=False),
        sa.Column(
            "display_order",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.product_id"],
            name="fk_product_images_product_id_products",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("product_image_id"),
    )
    op.create_index(
        "ix_product_images_product_id",
        "product_images",
        ["product_id"],
        unique=False,
    )

    product_table = sa.table(
        "products",
        sa.column("product_id", sa.Integer()),
        sa.column("image_url", sa.String(length=2048)),
    )
    product_images_table = sa.table(
        "product_images",
        sa.column("product_id", sa.Integer()),
        sa.column("image_url", sa.String(length=2048)),
        sa.column("display_order", sa.Integer()),
    )
    image_select = sa.select(
        product_table.c.product_id,
        product_table.c.image_url,
        sa.literal(0),
    ).where(
        product_table.c.image_url.is_not(None),
        product_table.c.image_url != "",
    )
    op.get_bind().execute(
        sa.insert(product_images_table).from_select(
            ["product_id", "image_url", "display_order"],
            image_select,
        )
    )


def downgrade():
    op.drop_index("ix_product_images_product_id", table_name="product_images")
    op.drop_table("product_images")
