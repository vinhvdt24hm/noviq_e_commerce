import unittest

from app import create_app
from app.extensions import db
from app.models import Product, User


class SingleSellerStoreTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config.update(
            TESTING=True,
            SECRET_KEY="test-secret",
            SQLALCHEMY_DATABASE_URI="sqlite://",
        )

    def setUp(self):
        with self.app.app_context():
            db.drop_all()
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def run_create_seller(self, email):
        return self.app.test_cli_runner().invoke(
            args=[
                "create-seller",
                "--email",
                email,
                "--full-name",
                "Store Owner",
                "--password",
                "valid-password",
            ],
            input="valid-password\n",
        )

    def test_create_seller_command_allows_only_one_account(self):
        first = self.run_create_seller("owner@example.com")
        second = self.run_create_seller("second@example.com")

        self.assertEqual(first.exit_code, 0, first.output)
        self.assertNotEqual(second.exit_code, 0)
        self.assertIn("one seller account", second.output.lower())
        with self.app.app_context():
            self.assertEqual(User.query.filter_by(role="seller").count(), 1)

    def test_seller_only_endpoints_reject_multiple_active_sellers(self):
        with self.app.app_context():
            db.session.add_all(
                [
                    User(
                        full_name="Seller A",
                        email="seller-a@example.com",
                        password_hash="unused",
                        role="seller",
                    ),
                    User(
                        full_name="Seller B",
                        email="seller-b@example.com",
                        password_hash="unused",
                        role="seller",
                    ),
                ]
            )
            db.session.commit()
            seller_id = User.query.filter_by(email="seller-a@example.com").first().user_id

        client = self.app.test_client()
        with client.session_transaction() as session:
            session["user_id"] = seller_id

        response = client.get("/api/orders/seller")

        self.assertEqual(response.status_code, 403)
        self.assertIn("exactly one active seller", response.json["error"])

    def test_single_seller_can_manage_storewide_products(self):
        result = self.run_create_seller("owner@example.com")
        self.assertEqual(result.exit_code, 0, result.output)

        with self.app.app_context():
            seller = User.query.filter_by(role="seller").first()
            db.session.add(
                Product(
                    product_name="Store product",
                    price=100,
                    stock=3,
                    is_active=True,
                )
            )
            db.session.commit()
            seller_id = seller.user_id

        client = self.app.test_client()
        with client.session_transaction() as session:
            session["user_id"] = seller_id
            session["csrf_token"] = "test-csrf-token"

        response = client.post(
            "/api/products/",
            headers={"X-CSRF-Token": "test-csrf-token"},
            json={
                "name": "Another store product",
                "category": "",
                "price": 200,
                "stock": 4,
                "description": "",
                "image_url": "",
            },
        )

        self.assertEqual(response.status_code, 201)
        with self.app.app_context():
            self.assertEqual(Product.query.count(), 2)


if __name__ == "__main__":
    unittest.main()
