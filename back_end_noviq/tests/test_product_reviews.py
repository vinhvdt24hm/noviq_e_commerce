import unittest

from app import create_app
from app.extensions import db
from app.models import Product, ProductReview, Store, User


class ProductReviewApiTests(unittest.TestCase):
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
            seller = User(
                full_name="Store Owner",
                email="review-store@example.com",
                password_hash="unused",
                role="seller",
            )
            customer = User(
                full_name="Verified Customer",
                email="review-customer@example.com",
                password_hash="unused",
                role="customer",
            )
            db.session.add_all([seller, customer])
            db.session.flush()
            store = Store(
                owner_user_id=seller.user_id,
                name="Review Store",
                slug="review-store",
            )
            db.session.add(store)
            db.session.flush()
            product = Product(
                store_id=store.store_id,
                product_name="Review Product",
                price=100,
                stock=5,
                is_active=True,
            )
            db.session.add(product)
            db.session.commit()
            self.customer_id = customer.user_id
            self.seller_id = seller.user_id
            self.product_id = product.product_id

        self.client = self.app.test_client()
        with self.client.session_transaction() as session:
            session["csrf_token"] = "review-csrf-token"

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def login_as(self, user_id):
        with self.client.session_transaction() as session:
            session["user_id"] = user_id

    def test_customer_review_is_persisted_and_returned_in_public_feed(self):
        self.login_as(self.customer_id)
        response = self.client.post(
            f"/api/products/{self.product_id}/reviews",
            headers={"X-CSRF-Token": "review-csrf-token"},
            json={
                "name": "Impersonated Name",
                "rating": 5,
                "comment": "  Sản phẩm đúng mô tả.  ",
            },
        )

        self.assertEqual(response.status_code, 201, response.json)
        self.assertEqual(response.json["data"]["name"], "Verified Customer")
        self.assertEqual(response.json["data"]["comment"], "Sản phẩm đúng mô tả.")

        feed = self.client.get(f"/api/products/{self.product_id}/reviews")
        self.assertEqual(feed.status_code, 200)
        self.assertEqual(feed.json["summary"], {"count": 1, "average": 5.0})
        self.assertTrue(feed.json["current_user_reviewed"])
        self.assertEqual(feed.json["data"][0]["id"], response.json["data"]["id"])

        with self.app.app_context():
            self.assertEqual(ProductReview.query.count(), 1)

    def test_review_creation_requires_login_and_csrf(self):
        payload = {"rating": 4, "comment": "Good quality."}
        anonymous = self.client.post(
            f"/api/products/{self.product_id}/reviews",
            headers={"X-CSRF-Token": "review-csrf-token"},
            json=payload,
        )
        self.assertEqual(anonymous.status_code, 401)

        self.login_as(self.customer_id)
        missing_csrf = self.client.post(
            f"/api/products/{self.product_id}/reviews",
            json=payload,
        )
        self.assertEqual(missing_csrf.status_code, 403)

    def test_non_customer_cannot_submit_review(self):
        self.login_as(self.seller_id)
        response = self.client.post(
            f"/api/products/{self.product_id}/reviews",
            headers={"X-CSRF-Token": "review-csrf-token"},
            json={"rating": 4, "comment": "Good quality."},
        )
        self.assertEqual(response.status_code, 403)

    def test_review_validation_rejects_invalid_rating_or_comment(self):
        self.login_as(self.customer_id)
        for payload in (
            {"rating": True, "comment": "Review."},
            {"rating": 6, "comment": "Review."},
            {"rating": 4, "comment": "   "},
            {"rating": 4, "comment": "x" * 1001},
        ):
            with self.subTest(payload=payload):
                response = self.client.post(
                    f"/api/products/{self.product_id}/reviews",
                    headers={"X-CSRF-Token": "review-csrf-token"},
                    json=payload,
                )
                self.assertEqual(response.status_code, 400)

    def test_reviews_are_hidden_for_inactive_products(self):
        with self.app.app_context():
            product = db.session.get(Product, self.product_id)
            product.is_active = False
            db.session.commit()

        self.assertEqual(
            self.client.get(
                f"/api/products/{self.product_id}/reviews"
            ).status_code,
            404,
        )


if __name__ == "__main__":
    unittest.main()