"""Add parent-child relationships to product categories.

Revision ID: 20261115_category_hierarchy
Revises: 20261114_multi_store
Create Date: 2026-11-15
"""
from alembic import op
import sqlalchemy as sa


revision = "20261115_category_hierarchy"
down_revision = "20261114_multi_store"
branch_labels = None
depends_on = None


CATEGORY_TREE = {
    "Thời trang": {},
    "Điện tử": {
        "Máy tính": {
            "Laptop": {
                "Gaming": {},
                "Văn phòng": {},
                "Đồ họa": {},
            },
            "Máy tính để bàn": {},
            "Linh kiện máy tính": {},
        },
        "Điện thoại và máy tính bảng": {},
        "Âm thanh": {},
        "Phụ kiện điện tử": {},
    },
    "Gia dụng": {},
    "Làm đẹp": {},
    "Đời sống": {},
    "Thể thao": {},
    "Phụ kiện": {},
    "Giày dép": {},
    "Mỹ phẩm": {},
    "Khác": {},
}


def _find_or_create_category(connection, category_table, name, parent_id):
    category_id = connection.execute(
        sa.select(category_table.c.category_id).where(
            category_table.c.category_name == name,
            category_table.c.parent_id == parent_id,
        )
    ).scalar_one_or_none()
    if category_id is not None:
        return category_id

    connection.execute(
        category_table.insert().values(
            category_name=name,
            parent_id=parent_id,
            is_active=True,
            created_at=sa.func.current_timestamp(),
        )
    )
    return connection.execute(
        sa.select(category_table.c.category_id).where(
            category_table.c.category_name == name,
            category_table.c.parent_id == parent_id,
        )
    ).scalar_one()


def _seed_tree(connection, category_table, tree, parent_id=None):
    for name, children in tree.items():
        category_id = _find_or_create_category(
            connection,
            category_table,
            name,
            parent_id,
        )
        _seed_tree(connection, category_table, children, category_id)


def upgrade():
    with op.batch_alter_table("categories") as batch_op:
        batch_op.add_column(sa.Column("parent_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_categories_parent_id_categories",
            "categories",
            ["parent_id"],
            ["category_id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_categories_parent_id", ["parent_id"])

    category_table = sa.table(
        "categories",
        sa.column("category_id", sa.Integer()),
        sa.column("category_name", sa.String(length=100)),
        sa.column("parent_id", sa.Integer()),
        sa.column("is_active", sa.Boolean()),
        sa.column("created_at", sa.DateTime()),
    )
    _seed_tree(op.get_bind(), category_table, CATEGORY_TREE)


def downgrade():
    with op.batch_alter_table("categories") as batch_op:
        batch_op.drop_index("ix_categories_parent_id")
        batch_op.drop_constraint(
            "fk_categories_parent_id_categories",
            type_="foreignkey",
        )
        batch_op.drop_column("parent_id")