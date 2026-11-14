import os
import re
import unittest
from unittest.mock import patch

from app import create_app
from app.extensions import db
from app.models import Category, OrderLine, OrderRecord, Product, Store, User
from werkzeug.security import check_password_hash, generate_password_hash


class AdminDashboardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app(
            {
                "TESTING": True,
                "SECRET_KEY": "test-secret",
                "SQLALCHEMY_DATABASE_URI": "sqlite://",
            }
        )

    def setUp(self):
        with self.app.app_context():
            if db.engine.dialect.name != "sqlite":
                raise RuntimeError("Tests must use an isolated SQLite database.")
            db.drop_all()
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            if db.engine.dialect.name != "sqlite":
                raise RuntimeError("Tests must use an isolated SQLite database.")
            db.session.remove()
            db.drop_all()

    def create_account(self, role, email):
        with self.app.app_context():
            user = User(
                full_name=email.split("@", 1)[0].title(),
                email=email,
                password_hash=generate_password_hash("Correct-Horse-Battery-1"),
                role=role,
            )
            db.session.add(user)
            db.session.flush()
            if role == "seller":
                store = Store(
                    owner_user_id=user.user_id,
                    name=f"{user.full_name} Store",
                    slug=email.split("@", 1)[0],
                )
                db.session.add(store)
                db.session.flush()
            user_id = user.user_id
            store_id = store.store_id if role == "seller" else None
            db.session.commit()
        return user_id, store_id

    def login_admin(self):
        admin_id, _ = self.create_account("admin", "admin@example.com")
        client = self.app.test_client()
        with client.session_transaction() as session:
            session["user_id"] = admin_id
            session["csrf_token"] = "admin-csrf-token"
        return client

    def test_admin_page_requires_admin_role(self):
        anonymous = self.app.test_client().get("/admin")
        self.assertEqual(anonymous.status_code, 302)
        self.assertIn("/admin/login", anonymous.headers["Location"])
        self.assertEqual(
            self.app.test_client().get("/admin/stores").status_code,
            302,
        )
        self.assertEqual(
            self.app.test_client().get("/admin/products").status_code,
            302,
        )

        seller_id, _ = self.create_account("seller", "seller@example.com")
        seller_client = self.app.test_client()
        with seller_client.session_transaction() as session:
            session["user_id"] = seller_id

        response = seller_client.get("/admin")
        self.assertEqual(response.status_code, 403)
        self.assertIn("không có quyền", response.get_data(as_text=True).lower())
        self.assertEqual(seller_client.get("/admin/stores").status_code, 403)
        self.assertEqual(seller_client.get("/admin/products").status_code, 403)
        self.assertEqual(seller_client.get("/admin/login").status_code, 200)

    def test_admin_login_requires_csrf_and_valid_admin_credentials(self):
        self.create_account("admin", "admin@example.com")
        client = self.app.test_client()
        with client.session_transaction() as session:
            session["csrf_token"] = "api-csrf-token"
        api_login = client.post(
            "/api/auth/login",
            headers={"X-CSRF-Token": "api-csrf-token"},
            json={
                "email": "admin@example.com",
                "password": "Correct-Horse-Battery-1",
            },
        )
        self.assertEqual(api_login.status_code, 403)

        login_page = client.get("/admin/login")
        self.assertEqual(login_page.status_code, 200)

        with client.session_transaction() as session:
            csrf_token = session["csrf_token"]

        missing_csrf = client.post(
            "/admin/login",
            data={
                "email": "admin@example.com",
                "password": "Correct-Horse-Battery-1",
            },
        )
        self.assertEqual(missing_csrf.status_code, 403)

        response = client.post(
            "/admin/login",
            data={
                "csrf_token": csrf_token,
                "email": "admin@example.com",
                "password": "Correct-Horse-Battery-1",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin", response.headers["Location"])
        self.assertEqual(client.get("/admin").status_code, 200)

    def test_admin_dashboard_reports_only_completed_sales(self):
        seller_a_id, store_a_id = self.create_account(
            "seller",
            "seller-a@example.com",
        )
        _, store_b_id = self.create_account("seller", "seller-b@example.com")
        with self.app.app_context():
            product_a = Product(
                store_id=store_a_id,
                product_name="Completed item",
                price=125,
                stock=4,
                is_active=True,
            )
            product_b = Product(
                store_id=store_b_id,
                product_name="Pending item",
                price=300,
                stock=2,
                is_active=True,
            )
            customer = User(
                full_name="Customer",
                email="customer@example.com",
                password_hash="unused",
                role="customer",
            )
            db.session.add_all([product_a, product_b, customer])
            db.session.flush()

            completed = OrderRecord(
                store_id=store_a_id,
                checkout_id="checkout-completed",
                user_id=customer.user_id,
                order_number="NQ-COMPLETED",
                recipient_name="Customer",
                phone_number="0123456789",
                shipping_address="HCMC",
                total_amount=250,
                status="completed",
            )
            pending = OrderRecord(
                store_id=store_b_id,
                checkout_id="checkout-pending",
                user_id=customer.user_id,
                order_number="NQ-PENDING",
                recipient_name="Customer",
                phone_number="0123456789",
                shipping_address="HCMC",
                total_amount=300,
                status="pending",
            )
            db.session.add_all([completed, pending])
            db.session.flush()
            db.session.add_all(
                [
                    OrderLine(
                        order_id=completed.order_id,
                        product_id=product_a.product_id,
                        product_name=product_a.product_name,
                        quantity=2,
                        unit_price=125,
                    ),
                    OrderLine(
                        order_id=pending.order_id,
                        product_id=product_b.product_id,
                        product_name=product_b.product_name,
                        quantity=1,
                        unit_price=300,
                    ),
                ]
            )
            db.session.commit()

        client = self.login_admin()
        dashboard_response = client.get("/admin")
        self.assertEqual(dashboard_response.status_code, 200)
        dashboard_page = dashboard_response.get_data(as_text=True)
        self.assertIn("1", dashboard_page)
        self.assertIn("250 ₫", dashboard_page)

        stores_response = client.get("/admin/stores")
        self.assertEqual(stores_response.status_code, 200)
        stores_page = stores_response.get_data(as_text=True)
        self.assertIn("seller-a@example.com", stores_page)
        self.assertIn("seller-b@example.com", stores_page)

        products_response = client.get("/admin/products")
        self.assertEqual(products_response.status_code, 200)
        products_page = products_response.get_data(as_text=True)
        self.assertIn("Completed item", products_page)
        self.assertIn("Pending item", products_page)
        self.assertRegex(
            products_page,
            re.compile(
                r"<tr>.*?<strong>Completed item</strong>.*?"
                r"<td>2</td>\s*<td>250 ₫</td>",
                re.DOTALL,
            ),
        )
        self.assertRegex(
            products_page,
            re.compile(
                r"<tr>.*?<strong>Pending item</strong>.*?"
                r"<td>0</td>\s*<td>0 ₫</td>",
                re.DOTALL,
            ),
        )
        self.assertEqual(products_page.count("300 ₫"), 1)

    def test_dashboard_renders_monthly_charts_and_customer_summary(self):
        self.create_account("customer", "chart-customer@example.com")

        response = self.login_admin().get("/admin")

        self.assertEqual(response.status_code, 200)
        page = response.get_data(as_text=True)
        self.assertEqual(page.count('class="bar-chart"'), 2)
        self.assertEqual(page.count('class="bar-column"'), 12)
        self.assertIn("Tài khoản khách hàng", page)
        self.assertIn("Xu hướng doanh thu", page)

    def test_customer_management_searches_only_customers_and_filters_status(self):
        self.create_account("customer", "active-customer@example.com")
        inactive_id, _ = self.create_account(
            "customer",
            "inactive-customer@example.com",
        )
        self.create_account("seller", "seller-customer-test@example.com")
        with self.app.app_context():
            inactive_customer = db.session.get(User, inactive_id)
            inactive_customer.is_active = False
            db.session.commit()

        response = self.login_admin().get(
            "/admin/customers?q=customer&status=active"
        )

        self.assertEqual(response.status_code, 200)
        page = response.get_data(as_text=True)
        self.assertIn("active-customer@example.com", page)
        self.assertNotIn("inactive-customer@example.com", page)
        self.assertNotIn("seller-customer-test@example.com", page)

    def test_store_page_searches_and_reports_store_sales(self):
        _, active_store_id = self.create_account(
            "seller",
            "active-store-owner@example.com",
        )
        _, inactive_store_id = self.create_account(
            "seller",
            "inactive-store-owner@example.com",
        )
        with self.app.app_context():
            active_store = db.session.get(Store, active_store_id)
            inactive_store = db.session.get(Store, inactive_store_id)
            inactive_store.is_active = False
            customer = User(
                full_name="Store Customer",
                email="store-customer@example.com",
                password_hash="unused",
                role="customer",
            )
            db.session.add(customer)
            db.session.flush()
            order = OrderRecord(
                store_id=active_store.store_id,
                checkout_id="store-page-checkout",
                user_id=customer.user_id,
                order_number="STORE-PAGE-ORDER",
                recipient_name="Store Customer",
                phone_number="0123456789",
                shipping_address="HCMC",
                total_amount=250,
                status="completed",
            )
            db.session.add(order)
            db.session.commit()

        response = self.login_admin().get(
            "/admin/stores?q=active-store-owner&status=active"
        )

        self.assertEqual(response.status_code, 200)
        page = response.get_data(as_text=True)
        self.assertIn("active-store-owner@example.com", page)
        self.assertNotIn("inactive-store-owner@example.com", page)
        self.assertIn("250 ₫", page)

    def test_products_page_searches_and_reports_completed_sales(self):
        _, store_id = self.create_account("seller", "product-owner@example.com")
        with self.app.app_context():
            customer = User(
                full_name="Product Customer",
                email="product-customer@example.com",
                password_hash="unused",
                role="customer",
            )
            active_product = Product(
                store_id=store_id,
                product_name="Active product",
                price=125,
                stock=4,
                is_active=True,
            )
            inactive_product = Product(
                store_id=store_id,
                product_name="Hidden product",
                price=300,
                stock=2,
                is_active=False,
            )
            db.session.add_all([customer, active_product, inactive_product])
            db.session.flush()
            order = OrderRecord(
                store_id=store_id,
                checkout_id="product-page-checkout",
                user_id=customer.user_id,
                order_number="PRODUCT-PAGE-ORDER",
                recipient_name="Product Customer",
                phone_number="0123456789",
                shipping_address="HCMC",
                total_amount=250,
                status="completed",
            )
            db.session.add(order)
            db.session.flush()
            db.session.add(
                OrderLine(
                    order_id=order.order_id,
                    product_id=active_product.product_id,
                    product_name=active_product.product_name,
                    quantity=2,
                    unit_price=125,
                )
            )
            db.session.commit()

        response = self.login_admin().get(
            "/admin/products?q=active&status=active"
        )

        self.assertEqual(response.status_code, 200)
        page = response.get_data(as_text=True)
        self.assertIn("Active product", page)
        self.assertNotIn("Hidden product", page)
        self.assertIn("2", page)
        self.assertIn("250 ₫", page)

    def test_admin_can_disable_and_reenable_only_customer_accounts(self):
        customer_id, _ = self.create_account(
            "customer",
            "managed-customer@example.com",
        )
        seller_id, _ = self.create_account(
            "seller",
            "unmanaged-seller@example.com",
        )
        client = self.login_admin()

        disabled = client.post(
            f"/admin/customers/{customer_id}/toggle-status",
            data={
                "csrf_token": "admin-csrf-token",
                "status": "all",
                "page": "1",
            },
        )
        self.assertEqual(disabled.status_code, 302)
        with self.app.app_context():
            self.assertFalse(db.session.get(User, customer_id).is_active)
        inactive_login = client.post(
            "/api/auth/login",
            headers={"X-CSRF-Token": "admin-csrf-token"},
            json={
                "email": "managed-customer@example.com",
                "password": "Correct-Horse-Battery-1",
            },
        )
        self.assertEqual(inactive_login.status_code, 401)

        enabled = client.post(
            f"/admin/customers/{customer_id}/toggle-status",
            data={
                "csrf_token": "admin-csrf-token",
                "status": "all",
                "page": "1",
            },
        )
        self.assertEqual(enabled.status_code, 302)
        with self.app.app_context():
            self.assertTrue(db.session.get(User, customer_id).is_active)

        seller_response = client.post(
            f"/admin/customers/{seller_id}/toggle-status",
            data={"csrf_token": "admin-csrf-token"},
        )
        self.assertEqual(seller_response.status_code, 404)

    def test_admin_can_create_a_seller_and_store(self):
        client = self.login_admin()
        response = client.post(
            "/admin/sellers",
            data={
                "csrf_token": "admin-csrf-token",
                "full_name": "New Seller",
                "email": "new-seller@example.com",
                "store_name": "New Store",
                "password": "seller-initial-password",
            },
        )

        self.assertEqual(response.status_code, 302)
        with self.app.app_context():
            seller = User.query.filter_by(email="new-seller@example.com").one()
            self.assertEqual(seller.role, "seller")
            self.assertTrue(
                check_password_hash(
                    seller.password_hash,
                    "seller-initial-password",
                )
            )
            self.assertEqual(seller.store.name, "New Store")
            self.assertEqual(seller.store.slug, "new-store")

    def test_admin_can_create_a_nested_category(self):
        with self.app.app_context():
            parent = Category(category_name="Điện tử")
            db.session.add(parent)
            db.session.commit()
            parent_id = parent.category_id

        client = self.login_admin()
        response = client.post(
            "/admin/categories",
            data={
                "csrf_token": "admin-csrf-token",
                "category_name": "Máy tính",
                "parent_id": str(parent_id),
            },
        )

        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin/categories", response.headers["Location"])
        with self.app.app_context():
            category = Category.query.filter_by(category_name="Máy tính").one()
            self.assertEqual(category.parent_id, parent_id)

        page = client.get("/admin/categories")
        self.assertEqual(page.status_code, 200)
        self.assertIn("Điện tử / Máy tính", page.get_data(as_text=True))

    def test_create_admin_command_requires_strong_password_and_creates_account(self):
        weak_password = self.app.test_cli_runner().invoke(
            args=[
                "create-admin",
                "--email",
                "admin@example.com",
                "--full-name",
                "Website Admin",
                "--password",
                "short-pass",
            ],
            input="short-pass\n",
        )
        self.assertNotEqual(weak_password.exit_code, 0)
        self.assertIn("at least 12", weak_password.output.lower())

        result = self.app.test_cli_runner().invoke(
            args=[
                "create-admin",
                "--email",
                "admin@example.com",
                "--full-name",
                "Website Admin",
                "--password",
                "correct-horse-battery-1",
            ],
            input="correct-horse-battery-1\n",
        )
        self.assertEqual(result.exit_code, 0, result.output)
        with self.app.app_context():
            admin = User.query.filter_by(email="admin@example.com").one()
            self.assertEqual(admin.role, "admin")

    def test_create_admin_command_accepts_a_secret_environment_variable(self):
        password = "correct-horse-battery-2"
        with patch.dict(os.environ, {"ADMIN_BOOTSTRAP_PASSWORD": password}):
            result = self.app.test_cli_runner().invoke(
                args=[
                    "create-admin",
                    "--email",
                    "job-admin@example.com",
                    "--full-name",
                    "Job Admin",
                ],
                input="",
            )

        self.assertEqual(result.exit_code, 0, result.output)
        with self.app.app_context():
            admin = User.query.filter_by(email="job-admin@example.com").one()
            self.assertEqual(admin.role, "admin")
            self.assertTrue(check_password_hash(admin.password_hash, password))


if __name__ == "__main__":
    unittest.main()
