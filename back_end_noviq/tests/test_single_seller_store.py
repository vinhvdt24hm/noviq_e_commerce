import unittest

from app import create_app
from app.extensions import db
from app.models import Category, OrderRecord, Product, Store, User


class MultiStoreMarketplaceTests(unittest.TestCase):
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

    def run_create_seller(self, email, store_name=None):
        store_name = store_name or f"{email.split('@', 1)[0]} Store"
        return self.app.test_cli_runner().invoke(
            args=[
                "create-seller",
                "--email",
                email,
                "--full-name",
                "Store Owner",
                "--store-name",
                store_name,
                "--password",
                "valid-password",
            ],
            input="valid-password\n",
        )

    def create_seller(self, email, store_name=None):
        result = self.run_create_seller(email, store_name)
        self.assertEqual(result.exit_code, 0, result.output)
        with self.app.app_context():
            user = User.query.filter_by(email=email).one()
            return user.user_id, user.store.store_id

    def test_public_registration_cannot_create_a_seller(self):
        client = self.app.test_client()
        with client.session_transaction() as session:
            session["csrf_token"] = "test-csrf-token"

        response = client.post(
            "/api/auth/register",
            headers={"X-CSRF-Token": "test-csrf-token"},
            json={
                "full_name": "New account",
                "email": "new@example.com",
                "password": "valid-password",
                "role": "seller",
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json["data"]["role"], "customer")
        self.assertNotIn("store", response.json["data"])

    def test_create_seller_command_creates_multiple_independent_stores(self):
        first = self.run_create_seller("owner@example.com", "Owner Store")
        second = self.run_create_seller("second@example.com", "Owner Store")

        self.assertEqual(first.exit_code, 0, first.output)
        self.assertEqual(second.exit_code, 0, second.output)
        with self.app.app_context():
            self.assertEqual(User.query.filter_by(role="seller").count(), 2)
            self.assertEqual(Store.query.count(), 2)
            self.assertEqual(
                Store.query.filter_by(name="Owner Store").count(),
                2,
            )
            self.assertEqual(
                len({store.slug for store in Store.query.all()}),
                2,
            )

    def test_seller_endpoints_only_return_and_change_their_store_data(self):
        seller_a_id, store_a_id = self.create_seller("seller-a@example.com")
        seller_b_id, store_b_id = self.create_seller("seller-b@example.com")
        with self.app.app_context():
            product_a = Product(
                store_id=store_a_id,
                product_name="Seller A product",
                price=100,
                stock=5,
                is_active=True,
            )
            product_b = Product(
                store_id=store_b_id,
                product_name="Seller B product",
                price=200,
                stock=5,
                is_active=True,
            )
            product_a_second = Product(
                store_id=store_a_id,
                product_name="Seller A second product",
                price=50,
                stock=3,
                is_active=True,
            )
            customer = User(
                full_name="Customer",
                email="customer@example.com",
                password_hash="unused",
                role="customer",
            )
            db.session.add_all([product_a, product_a_second, product_b, customer])
            db.session.commit()
            product_a_id = product_a.product_id
            product_a_second_id = product_a_second.product_id
            product_b_id = product_b.product_id
            customer_id = customer.user_id

        customer_client = self.app.test_client()
        with customer_client.session_transaction() as session:
            session["user_id"] = customer_id
            session["csrf_token"] = "test-csrf-token"
        checkout = customer_client.post(
            "/api/orders/",
            headers={"X-CSRF-Token": "test-csrf-token"},
            json={
                "recipient_name": "Customer",
                "phone_number": "0123456789",
                "shipping_address": "HCMC",
                "items": [
                    {"product_id": product_a_id, "quantity": 1},
                    {"product_id": product_a_second_id, "quantity": 1},
                    {"product_id": product_b_id, "quantity": 2},
                ],
            },
        )

        self.assertEqual(checkout.status_code, 201, checkout.json)
        self.assertEqual(len(checkout.json["data"]["orders"]), 2)
        orders_by_store = {
            order["store"]["id"]: order
            for order in checkout.json["data"]["orders"]
        }
        self.assertEqual(
            set(orders_by_store),
            {store_a_id, store_b_id},
        )
        self.assertEqual(len(orders_by_store[store_a_id]["items"]), 2)
        self.assertEqual(len(orders_by_store[store_b_id]["items"]), 1)
        self.assertEqual(
            len({order["checkout_id"] for order in checkout.json["data"]["orders"]}),
            1,
        )
        self.assertEqual(
            len(customer_client.get("/api/orders/").json["data"]),
            2,
        )

        seller_a_client = self.app.test_client()
        with seller_a_client.session_transaction() as session:
            session["user_id"] = seller_a_id
            session["csrf_token"] = "test-csrf-token"
        products_response = seller_a_client.get("/api/products/seller")
        orders_response = seller_a_client.get("/api/orders/seller")
        self.assertEqual(
            {
                product["name"]
                for product in products_response.json["data"]
            },
            {"Seller A product", "Seller A second product"},
        )
        self.assertEqual(len(orders_response.json["data"]), 1)
        self.assertEqual(
            orders_response.json["data"][0]["store"]["id"], store_a_id
        )

        response = seller_a_client.patch(
            f"/api/orders/{orders_by_store[store_b_id]['order_id']}/status",
            headers={"X-CSRF-Token": "test-csrf-token"},
            json={"status": "processing"},
        )
        self.assertEqual(response.status_code, 404)

        response = seller_a_client.put(
            f"/api/products/{product_b_id}",
            headers={"X-CSRF-Token": "test-csrf-token"},
            json={
                "name": "Stolen product",
                "category": "",
                "price": 200,
                "stock": 5,
                "description": "",
            },
        )
        self.assertEqual(response.status_code, 404)

        response = seller_a_client.patch(
            f"/api/products/{product_b_id}/stock",
            headers={"X-CSRF-Token": "test-csrf-token"},
            json={"stock": 99},
        )
        self.assertEqual(response.status_code, 404)

        with self.app.app_context():
            self.assertEqual(
                Product.query.filter_by(product_id=product_a_id).one().stock,
                4,
            )
            self.assertEqual(
                Product.query.filter_by(product_id=product_a_second_id).one().stock,
                2,
            )
            self.assertEqual(
                Product.query.filter_by(product_id=product_b_id).one().stock,
                3,
            )
            self.assertEqual(OrderRecord.query.count(), 2)

        other_customer_client = self.app.test_client()
        with self.app.app_context():
            other_customer = User(
                full_name="Other customer",
                email="other-customer@example.com",
                password_hash="unused",
                role="customer",
            )
            db.session.add(other_customer)
            db.session.commit()
            other_customer_id = other_customer.user_id
        with other_customer_client.session_transaction() as session:
            session["user_id"] = other_customer_id
        self.assertEqual(other_customer_client.get("/api/orders/").json["data"], [])

    def test_mixed_store_checkout_rolls_back_all_stock_when_one_store_is_short(self):
        _, store_a_id = self.create_seller("rollback-a@example.com")
        _, store_b_id = self.create_seller("rollback-b@example.com")
        with self.app.app_context():
            available_product = Product(
                store_id=store_a_id,
                product_name="Available product",
                price=100,
                stock=5,
                is_active=True,
            )
            unavailable_product = Product(
                store_id=store_b_id,
                product_name="Unavailable product",
                price=200,
                stock=0,
                is_active=True,
            )
            customer = User(
                full_name="Customer",
                email="rollback-customer@example.com",
                password_hash="unused",
                role="customer",
            )
            db.session.add_all([available_product, unavailable_product, customer])
            db.session.commit()
            available_product_id = available_product.product_id
            unavailable_product_id = unavailable_product.product_id
            customer_id = customer.user_id

        client = self.app.test_client()
        with client.session_transaction() as session:
            session["user_id"] = customer_id
            session["csrf_token"] = "test-csrf-token"
        response = client.post(
            "/api/orders/",
            headers={"X-CSRF-Token": "test-csrf-token"},
            json={
                "recipient_name": "Customer",
                "phone_number": "0123456789",
                "shipping_address": "HCMC",
                "items": [
                    {"product_id": available_product_id, "quantity": 1},
                    {"product_id": unavailable_product_id, "quantity": 1},
                ],
            },
        )

        self.assertEqual(response.status_code, 409)
        with self.app.app_context():
            self.assertEqual(OrderRecord.query.count(), 0)
            self.assertEqual(
                Product.query.filter_by(product_id=available_product_id).one().stock,
                5,
            )
            self.assertEqual(
                Product.query.filter_by(product_id=unavailable_product_id).one().stock,
                0,
            )

    def test_seller_can_manage_products_in_own_store(self):
        seller_id, store_id = self.create_seller("owner@example.com")

        with self.app.app_context():
            db.session.add(
                Product(
                    store_id=store_id,
                    product_name="Store product",
                    price=100,
                    stock=3,
                    is_active=True,
                )
            )
            db.session.commit()

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

    def test_product_api_supports_multiple_images_and_legacy_image_url(self):
        seller_id, _ = self.create_seller("owner@example.com")

        client = self.app.test_client()
        with client.session_transaction() as session:
            session["user_id"] = seller_id
            session["csrf_token"] = "test-csrf-token"

        image_urls = [
            "https://cdn.example.com/product-front.jpg",
            "https://cdn.example.com/product-side.jpg",
            "https://cdn.example.com/product-back.jpg",
        ]
        created = client.post(
            "/api/products/",
            headers={"X-CSRF-Token": "test-csrf-token"},
            json={
                "name": "Gallery product",
                "category": "",
                "price": 200,
                "stock": 4,
                "description": "",
                "image_urls": image_urls,
            },
        )

        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json["data"]["image_url"], image_urls[0])
        self.assertEqual(created.json["data"]["images"], image_urls)

        updated_image_urls = list(reversed(image_urls))
        updated = client.put(
            f"/api/products/{created.json['data']['id']}",
            headers={"X-CSRF-Token": "test-csrf-token"},
            json={
                "name": "Gallery product",
                "category": "",
                "price": 200,
                "stock": 4,
                "description": "",
                "image_urls": updated_image_urls,
            },
        )

        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json["data"]["image_url"], updated_image_urls[0])
        self.assertEqual(updated.json["data"]["images"], updated_image_urls)

        legacy = client.post(
            "/api/products/",
            headers={"X-CSRF-Token": "test-csrf-token"},
            json={
                "name": "Legacy image product",
                "category": "",
                "price": 300,
                "stock": 2,
                "description": "",
                "image_url": "https://cdn.example.com/legacy.jpg",
            },
        )

        self.assertEqual(legacy.status_code, 201)
        self.assertEqual(
            legacy.json["data"]["images"],
            ["https://cdn.example.com/legacy.jpg"],
        )

        detail = client.get(f"/api/products/{created.json['data']['id']}")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json["data"]["images"], updated_image_urls)

    def test_product_api_rejects_invalid_image_gallery(self):
        seller_id, _ = self.create_seller("owner@example.com")

        client = self.app.test_client()
        with client.session_transaction() as session:
            session["user_id"] = seller_id
            session["csrf_token"] = "test-csrf-token"

        response = client.post(
            "/api/products/",
            headers={"X-CSRF-Token": "test-csrf-token"},
            json={
                "name": "Invalid gallery",
                "category": "",
                "price": 200,
                "stock": 4,
                "image_urls": ["javascript:alert(1)"],
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("image_urls", response.json["error"])

    def test_product_list_filters_sorts_and_paginates(self):
        _, store_id = self.create_seller("catalog@example.com")
        with self.app.app_context():
            electronics = Category(category_name="Điện tử")
            home = Category(category_name="Gia dụng")
            db.session.add_all([electronics, home])
            db.session.flush()
            db.session.add_all(
                [
                    Product(
                        store_id=store_id,
                        product_name="Tai nghe Alpha",
                        category=electronics,
                        price=300,
                        stock=4,
                        is_active=True,
                    ),
                    Product(
                        store_id=store_id,
                        product_name="Tai nghe Beta",
                        category=electronics,
                        price=100,
                        stock=5,
                        is_active=True,
                    ),
                    Product(
                        store_id=store_id,
                        product_name="Tai nghe Gamma",
                        category=electronics,
                        price=200,
                        stock=6,
                        is_active=True,
                    ),
                    Product(
                        store_id=store_id,
                        product_name="Bình nước",
                        category=home,
                        price=50,
                        stock=7,
                        is_active=True,
                    ),
                    Product(
                        store_id=store_id,
                        product_name="Tai nghe đã ẩn",
                        category=electronics,
                        price=1,
                        stock=0,
                        is_active=False,
                    ),
                ]
            )
            db.session.commit()

        client = self.app.test_client()
        first_page = client.get(
            "/api/products/",
            query_string={
                "page": 1,
                "per_page": 2,
                "search": "tai nghe",
                "category": "Điện tử",
                "sort": "priceAsc",
            },
        )
        second_page = client.get(
            "/api/products/",
            query_string={
                "page": 2,
                "per_page": 2,
                "search": "tai nghe",
                "category": "Điện tử",
                "sort": "priceAsc",
            },
        )

        self.assertEqual(first_page.status_code, 200)
        self.assertEqual(
            [product["name"] for product in first_page.json["data"]],
            ["Tai nghe Beta", "Tai nghe Gamma"],
        )
        with self.app.app_context():
            store_slug = Store.query.filter_by(owner_user_id=User.query.filter_by(
                email="catalog@example.com"
            ).one().user_id).one().slug
        store_page = self.app.test_client().get(
            "/api/products/",
            query_string={"store": store_slug, "page": 1},
        )
        self.assertEqual(store_page.status_code, 200)
        self.assertTrue(
            all(
                product["store"]["slug"] == store_slug
                for product in store_page.json["data"]
            )
        )
        self.assertEqual(first_page.json["pagination"], {
            "page": 1,
            "per_page": 2,
            "total_items": 3,
            "total_pages": 2,
            "has_next": True,
            "has_prev": False,
        })
        self.assertCountEqual(first_page.json["categories"], ["Điện tử", "Gia dụng"])
        self.assertEqual(
            [product["name"] for product in second_page.json["data"]],
            ["Tai nghe Alpha"],
        )
        self.assertTrue(second_page.json["pagination"]["has_prev"])
        self.assertFalse(second_page.json["pagination"]["has_next"])

    def test_product_list_without_pagination_keeps_legacy_response(self):
        _, store_id = self.create_seller("legacy@example.com")
        with self.app.app_context():
            db.session.add_all(
                [
                    Product(
                        store_id=store_id,
                        product_name="Active product",
                        price=100,
                        stock=2,
                        is_active=True,
                    ),
                    Product(
                        store_id=store_id,
                        product_name="Inactive product",
                        price=200,
                        stock=0,
                        is_active=False,
                    ),
                ]
            )
            db.session.commit()

        response = self.app.test_client().get("/api/products/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [product["name"] for product in response.json["data"]],
            ["Active product"],
        )
        self.assertNotIn("pagination", response.json)

    def test_product_list_rejects_invalid_pagination_parameters(self):
        client = self.app.test_client()
        for query in (
            {"page": "0"},
            {"page": "not-a-number"},
            {"per_page": "51"},
            {"sort": "unknown"},
        ):
            with self.subTest(query=query):
                response = client.get("/api/products/", query_string=query)
                self.assertEqual(response.status_code, 400)
                self.assertIn("error", response.json)

    def test_category_tree_and_parent_filter_include_nested_products(self):
        _, store_id = self.create_seller("category-tree@example.com")
        with self.app.app_context():
            electronics = Category(category_name="Điện tử")
            computers = Category(category_name="Máy tính", parent=electronics)
            laptop = Category(category_name="Laptop", parent=computers)
            gaming = Category(category_name="Gaming", parent=laptop)
            home = Category(category_name="Gia dụng")
            db.session.add_all([electronics, home])
            db.session.flush()
            db.session.add_all(
                [
                    Product(
                        store_id=store_id,
                        product_name="Gaming laptop",
                        category=gaming,
                        price=2500,
                        stock=3,
                        is_active=True,
                    ),
                    Product(
                        store_id=store_id,
                        product_name="Home appliance",
                        category=home,
                        price=100,
                        stock=5,
                        is_active=True,
                    ),
                ]
            )
            db.session.commit()
            electronics_id = electronics.category_id

        client = self.app.test_client()
        tree_response = client.get("/api/products/categories")
        self.assertEqual(tree_response.status_code, 200)
        electronics_node = next(
            item for item in tree_response.json["data"]
            if item["id"] == electronics_id
        )
        self.assertEqual(
            [item["name"] for item in electronics_node["children"]],
            ["Máy tính"],
        )

        products_response = client.get(
            "/api/products/",
            query_string={"page": 1, "category_id": electronics_id},
        )
        self.assertEqual(products_response.status_code, 200)
        self.assertEqual(
            [item["name"] for item in products_response.json["data"]],
            ["Gaming laptop"],
        )


if __name__ == "__main__":
    unittest.main()
