"""Persist customer product reviews.

Revision ID: 20261116_product_reviews
Revises: 20261115_category_hierarchy
Create Date: 2026-11-16
"""
from alembic import op
import sqlalchemy as sa


revision = "20261116_product_reviews"
down_revision = "20261115_category_hierarchy"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "product_reviews",
        sa.Column("review_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("reviewer_name", sa.String(length=255), nullable=False),
        sa.Column("rating", sa.SmallInteger(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "rating >= 1 AND rating <= 5",
            name="ck_product_reviews_rating_range",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.product_id"],
            name="fk_product_reviews_product_id_products",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.user_id"],
            name="fk_product_reviews_user_id_users",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("review_id"),
    )
    op.create_index(
        "ix_product_reviews_product_id",
        "product_reviews",
        ["product_id"],
        unique=False,
    )
    op.create_index(
        "ix_product_reviews_user_id",
        "product_reviews",
        ["user_id"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_product_reviews_user_id", table_name="product_reviews")
    op.drop_index("ix_product_reviews_product_id", table_name="product_reviews")
    op.drop_table("product_reviews")