import importlib.util
import unittest
from pathlib import Path

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "migrations"
    / "versions"
    / "20261113_add_product_images.py"
)
MIGRATION_SPEC = importlib.util.spec_from_file_location(
    "product_image_migration",
    MIGRATION_PATH,
)
PRODUCT_IMAGE_MIGRATION = importlib.util.module_from_spec(MIGRATION_SPEC)
MIGRATION_SPEC.loader.exec_module(PRODUCT_IMAGE_MIGRATION)

MULTI_STORE_MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "migrations"
    / "versions"
    / "20261114_add_multi_store_support.py"
)
MULTI_STORE_MIGRATION_SPEC = importlib.util.spec_from_file_location(
    "multi_store_migration",
    MULTI_STORE_MIGRATION_PATH,
)
MULTI_STORE_MIGRATION = importlib.util.module_from_spec(MULTI_STORE_MIGRATION_SPEC)
MULTI_STORE_MIGRATION_SPEC.loader.exec_module(MULTI_STORE_MIGRATION)
CATEGORY_HIERARCHY_MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "migrations"
    / "versions"
    / "20261115_add_category_hierarchy.py"
)
CATEGORY_HIERARCHY_MIGRATION_SPEC = importlib.util.spec_from_file_location(
    "category_hierarchy_migration",
    CATEGORY_HIERARCHY_MIGRATION_PATH,
)
CATEGORY_HIERARCHY_MIGRATION = importlib.util.module_from_spec(
    CATEGORY_HIERARCHY_MIGRATION_SPEC
)
CATEGORY_HIERARCHY_MIGRATION_SPEC.loader.exec_module(
    CATEGORY_HIERARCHY_MIGRATION
)
PRODUCT_REVIEWS_MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "migrations"
    / "versions"
    / "20261116_add_product_reviews.py"
)
PRODUCT_REVIEWS_MIGRATION_SPEC = importlib.util.spec_from_file_location(
    "product_reviews_migration",
    PRODUCT_REVIEWS_MIGRATION_PATH,
)
PRODUCT_REVIEWS_MIGRATION = importlib.util.module_from_spec(
    PRODUCT_REVIEWS_MIGRATION_SPEC
)
PRODUCT_REVIEWS_MIGRATION_SPEC.loader.exec_module(PRODUCT_REVIEWS_MIGRATION)
REPAIR_MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "migrations"
    / "versions"
    / "20261103_repair_missing_business_tables.py"
)
REPAIR_MIGRATION_SPEC = importlib.util.spec_from_file_location(
    "repair_business_tables_migration",
    REPAIR_MIGRATION_PATH,
)
REPAIR_MIGRATION = importlib.util.module_from_spec(REPAIR_MIGRATION_SPEC)
REPAIR_MIGRATION_SPEC.loader.exec_module(REPAIR_MIGRATION)


def create_legacy_store_schema(connection, sellers, products, orders):
    connection.execute(sa.text(
        "CREATE TABLE users ("
        "user_id INTEGER PRIMARY KEY, full_name VARCHAR(255), "
        "email VARCHAR(255), role VARCHAR(20))"
    ))
    connection.execute(sa.text(
        "CREATE TABLE products ("
        "product_id INTEGER PRIMARY KEY, product_name VARCHAR(150))"
    ))
    connection.execute(sa.text(
        "CREATE TABLE orders ("
        "order_id INTEGER PRIMARY KEY, order_number VARCHAR(32) NOT NULL)"
    ))
    if sellers:
        connection.execute(
            sa.text(
                "INSERT INTO users (user_id, full_name, email, role) "
                "VALUES (:user_id, :full_name, :email, 'seller')"
            ),
            sellers,
        )
    if products:
        connection.execute(
            sa.text(
                "INSERT INTO products (product_id, product_name) "
                "VALUES (:id, :name)"
            ),
            products,
        )
    if orders:
        connection.execute(
            sa.text(
                "INSERT INTO orders (order_id, order_number) "
                "VALUES (:id, :number)"
            ),
            orders,
        )


class ProductImageMigrationTests(unittest.TestCase):
    def test_product_reviews_migration_creates_indexed_review_table(self):
        engine = sa.create_engine("sqlite://")
        try:
            with engine.begin() as connection:
                connection.execute(sa.text(
                    "CREATE TABLE products (product_id INTEGER PRIMARY KEY)"
                ))
                connection.execute(sa.text(
                    "CREATE TABLE users (user_id INTEGER PRIMARY KEY)"
                ))
                with Operations.context(MigrationContext.configure(connection)):
                    PRODUCT_REVIEWS_MIGRATION.upgrade()

                inspector = sa.inspect(connection)
                columns = {
                    column["name"]
                    for column in inspector.get_columns("product_reviews")
                }
                indexes = {
                    index["name"]
                    for index in inspector.get_indexes("product_reviews")
                }
                constraints = {
                    constraint["name"]
                    for constraint in inspector.get_check_constraints("product_reviews")
                }

            self.assertTrue(
                {
                    "product_id",
                    "user_id",
                    "reviewer_name",
                    "rating",
                    "comment",
                    "created_at",
                }.issubset(columns)
            )
            self.assertIn("ix_product_reviews_product_id", indexes)
            self.assertIn("ck_product_reviews_rating_range", constraints)
        finally:
            engine.dispose()

    def test_category_hierarchy_upgrade_preserves_categories_and_seeds_laptop_tree(self):
        engine = sa.create_engine("sqlite://")
        try:
            with engine.begin() as connection:
                connection.execute(sa.text(
                    "CREATE TABLE categories ("
                    "category_id INTEGER PRIMARY KEY AUTOINCREMENT, "
                    "category_name VARCHAR(100) NOT NULL, "
                    "description TEXT, is_active BOOLEAN NOT NULL, "
                    "created_at DATETIME NOT NULL)"
                ))
                connection.execute(sa.text(
                    "INSERT INTO categories "
                    "(category_id, category_name, description, is_active, created_at) "
                    "VALUES (7, 'Điện tử', NULL, 1, CURRENT_TIMESTAMP)"
                ))
                with Operations.context(MigrationContext.configure(connection)):
                    CATEGORY_HIERARCHY_MIGRATION.upgrade()

                rows = connection.execute(sa.text(
                    "SELECT parent.category_name, child.category_name "
                    "FROM categories AS child "
                    "JOIN categories AS parent ON parent.category_id = child.parent_id "
                    "WHERE child.category_name IN ('Máy tính', 'Laptop', 'Gaming') "
                    "ORDER BY child.category_id"
                )).all()
                preserved_root = connection.execute(sa.text(
                    "SELECT category_id FROM categories "
                    "WHERE category_name = 'Điện tử' AND parent_id IS NULL"
                )).scalar_one()

            self.assertEqual(preserved_root, 7)
            self.assertEqual(
                rows,
                [("Điện tử", "Máy tính"), ("Máy tính", "Laptop"), ("Laptop", "Gaming")],
            )
        finally:
            engine.dispose()

    def test_upgrade_copies_existing_cover_images_to_gallery(self):
        engine = sa.create_engine("sqlite://")
        try:
            with engine.begin() as connection:
                connection.execute(sa.text(
                    "CREATE TABLE products ("
                    "product_id INTEGER PRIMARY KEY, "
                    "image_url VARCHAR(2048)"
                    ")"
                ))
                connection.execute(
                    sa.text(
                        "INSERT INTO products (product_id, image_url) "
                        "VALUES (:product_id, :image_url)"
                    ),
                    [
                        {"product_id": 1, "image_url": "https://cdn.example/one.jpg"},
                        {"product_id": 2, "image_url": None},
                        {"product_id": 3, "image_url": ""},
                    ],
                )

                with Operations.context(MigrationContext.configure(connection)):
                    PRODUCT_IMAGE_MIGRATION.upgrade()

                rows = connection.execute(
                    sa.text(
                        "SELECT product_id, image_url, display_order "
                        "FROM product_images ORDER BY product_id"
                    )
                ).all()

            self.assertEqual(
                rows,
                [(1, "https://cdn.example/one.jpg", 0)],
            )
        finally:
            engine.dispose()

    def test_repair_migration_leaves_a_complete_schema_alone(self):
        engine = sa.create_engine("sqlite://")
        try:
            with engine.begin() as connection:
                for table_name in REPAIR_MIGRATION.BUSINESS_TABLES:
                    connection.execute(sa.text(
                        f"CREATE TABLE {table_name} (id INTEGER PRIMARY KEY)"
                    ))
                with Operations.context(MigrationContext.configure(connection)):
                    REPAIR_MIGRATION.upgrade()

                tables = set(sa.inspect(connection).get_table_names())

            self.assertTrue(REPAIR_MIGRATION.BUSINESS_TABLES.issubset(tables))
        finally:
            engine.dispose()

    def test_repair_migration_refuses_a_partially_present_schema(self):
        engine = sa.create_engine("sqlite://")
        try:
            with engine.begin() as connection:
                connection.execute(sa.text(
                    "CREATE TABLE products (id INTEGER PRIMARY KEY)"
                ))
                with Operations.context(MigrationContext.configure(connection)):
                    with self.assertRaisesRegex(RuntimeError, "only some exist"):
                        REPAIR_MIGRATION.upgrade()

                tables = set(sa.inspect(connection).get_table_names())

            self.assertEqual(tables, {"products"})
        finally:
            engine.dispose()

    def test_multi_store_upgrade_assigns_legacy_data_to_the_existing_seller(self):
        engine = sa.create_engine("sqlite://")
        try:
            with engine.begin() as connection:
                create_legacy_store_schema(
                    connection,
                    [{"user_id": 7, "full_name": "Seller", "email": "seller@example.com"}],
                    [{"id": 11, "name": "Legacy product"}],
                    [{"id": 13, "number": "NQ-LEGACY"}],
                )
                with Operations.context(MigrationContext.configure(connection)):
                    MULTI_STORE_MIGRATION.upgrade()

                store_id = connection.execute(
                    sa.text("SELECT store_id FROM stores WHERE owner_user_id = 7")
                ).scalar_one()
                product_store_id = connection.execute(
                    sa.text("SELECT store_id FROM products WHERE product_id = 11")
                ).scalar_one()
                order = connection.execute(
                    sa.text(
                        "SELECT store_id, checkout_id FROM orders WHERE order_id = 13"
                    )
                ).one()

            self.assertEqual(product_store_id, store_id)
            self.assertEqual(order, (store_id, "NQ-LEGACY"))
        finally:
            engine.dispose()

    def test_multi_store_upgrade_allows_an_empty_database_without_a_seller(self):
        engine = sa.create_engine("sqlite://")
        try:
            with engine.begin() as connection:
                create_legacy_store_schema(connection, [], [], [])
                with Operations.context(MigrationContext.configure(connection)):
                    MULTI_STORE_MIGRATION.upgrade()

                store_count = connection.execute(
                    sa.text("SELECT COUNT(*) FROM stores")
                ).scalar_one()
                product_store_not_null = {
                    row[1]: row[3]
                    for row in connection.execute(
                        sa.text("PRAGMA table_info(products)")
                    )
                }["store_id"]

            self.assertEqual(store_count, 0)
            self.assertEqual(product_store_not_null, 1)
        finally:
            engine.dispose()

    def test_multi_store_upgrade_refuses_ambiguous_legacy_ownership(self):
        engine = sa.create_engine("sqlite://")
        try:
            with engine.begin() as connection:
                create_legacy_store_schema(
                    connection,
                    [
                        {"user_id": 7, "full_name": "Seller A", "email": "a@example.com"},
                        {"user_id": 8, "full_name": "Seller B", "email": "b@example.com"},
                    ],
                    [{"id": 11, "name": "Unassigned product"}],
                    [],
                )
                with Operations.context(MigrationContext.configure(connection)):
                    with self.assertRaisesRegex(RuntimeError, "unambiguously"):
                        MULTI_STORE_MIGRATION.upgrade()

                tables = sa.inspect(connection).get_table_names()

            self.assertNotIn("stores", tables)
        finally:
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
