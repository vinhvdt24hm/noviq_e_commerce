import json
import unittest
from io import BytesIO
from unittest.mock import patch

from PIL import Image

from app import create_app
from app.extensions import db
from app.models import Product, ProductImage, Store, User


class FakeBlob:
    def __init__(self, name):
        self.name = name
        self.content = None
        self.content_type = None
        self.deleted = False

    def upload_from_file(
        self,
        file_obj,
        size=None,
        content_type=None,
        if_generation_match=None,
    ):
        self.content = file_obj.read()
        self.content_type = content_type

    def delete(self):
        self.deleted = True


class FakeBucket:
    def __init__(self):
        self.blobs = {}

    def blob(self, name):
        if name not in self.blobs:
            self.blobs[name] = FakeBlob(name)
        return self.blobs[name]


class FakeStorageClient:
    def __init__(self):
        self.fake_bucket = FakeBucket()

    def bucket(self, name):
        return self.fake_bucket


class ProductImageUploadTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app(
            {
                "TESTING": True,
                "SECRET_KEY": "test-secret",
                "SQLALCHEMY_DATABASE_URI": "sqlite://",
                "PRODUCT_IMAGES_BUCKET": None,
                "PRODUCT_IMAGES_PUBLIC_BASE_URL": None,
            }
        )

    def setUp(self):
        self.app.config["PRODUCT_IMAGES_BUCKET"] = None
        self.app.config["PRODUCT_IMAGES_PUBLIC_BASE_URL"] = None
        with self.app.app_context():
            if db.engine.dialect.name != "sqlite":
                raise RuntimeError("Tests must use an isolated SQLite database.")
            db.drop_all()
            db.create_all()
            seller = User(
                full_name="Image Seller",
                email="image-seller@example.com",
                password_hash="unused",
                role="seller",
            )
            db.session.add(seller)
            db.session.flush()
            store = Store(
                owner_user_id=seller.user_id,
                name="Image Store",
                slug="image-store",
            )
            db.session.add(store)
            db.session.commit()
            self.seller_id = seller.user_id
            self.store_id = store.store_id

        self.client = self.app.test_client()
        with self.client.session_transaction() as session:
            session["user_id"] = self.seller_id
            session["csrf_token"] = "image-upload-csrf-token"

    def tearDown(self):
        with self.app.app_context():
            if db.engine.dialect.name != "sqlite":
                raise RuntimeError("Tests must use an isolated SQLite database.")
            db.session.remove()
            db.drop_all()

    @staticmethod
    def image_bytes():
        image = Image.new("RGB", (16, 16), color=(150, 80, 120))
        content = BytesIO()
        image.save(content, format="PNG")
        return content.getvalue()

    @staticmethod
    def product_data():
        return {
            "name": "Uploaded product",
            "category": "",
            "price": 120,
            "stock": 4,
            "description": "A test product",
            "image_urls": [],
        }

    def post_product_with_image(self, image_content, filename="input.txt"):
        return self.client.post(
            "/api/products/",
            headers={"X-CSRF-Token": "image-upload-csrf-token"},
            data={
                "product": json.dumps(self.product_data()),
                "images": (BytesIO(image_content), filename, "text/plain"),
            },
        )

    def test_seller_uploads_validated_image_and_product_stores_public_url(self):
        self.app.config["PRODUCT_IMAGES_BUCKET"] = "noviq-test-images"
        fake_storage = FakeStorageClient()

        with patch(
            "app.services.product_images.storage.Client",
            return_value=fake_storage,
        ):
            response = self.post_product_with_image(self.image_bytes())

        self.assertEqual(response.status_code, 201, response.json)
        image_url = response.json["data"]["image_url"]
        self.assertTrue(
            image_url.startswith(
                "https://storage.googleapis.com/noviq-test-images/"
                f"stores/{self.store_id}/products/"
            )
        )
        uploaded_blobs = list(fake_storage.fake_bucket.blobs.values())
        self.assertEqual(len(uploaded_blobs), 1)
        self.assertEqual(uploaded_blobs[0].content_type, "image/png")
        with self.app.app_context():
            product = Product.query.one()
            self.assertEqual(product.image_url, image_url)
            self.assertEqual(ProductImage.query.one().image_url, image_url)

    def test_invalid_image_is_rejected_before_cloud_storage_access(self):
        with patch("app.services.product_images.storage.Client") as storage_client:
            response = self.post_product_with_image(b"not an image")

        self.assertEqual(response.status_code, 400)
        self.assertIn("valid supported image", response.json["error"])
        storage_client.assert_not_called()
        with self.app.app_context():
            self.assertEqual(Product.query.count(), 0)

    def test_upload_requires_a_configured_bucket(self):
        response = self.post_product_with_image(self.image_bytes())

        self.assertEqual(response.status_code, 503)
        self.assertIn("PRODUCT_IMAGES_BUCKET", response.json["error"])

    def test_upload_requires_csrf_token(self):
        response = self.client.post(
            "/api/products/",
            json=self.product_data(),
        )

        self.assertEqual(response.status_code, 403)

    def test_combined_product_image_count_is_limited_before_upload(self):
        self.app.config["PRODUCT_IMAGES_BUCKET"] = "noviq-test-images"
        data = {"product": json.dumps(self.product_data())}
        data["images"] = [
            (BytesIO(b"unused"), f"image-{index}.png", "image/png")
            for index in range(11)
        ]

        with patch("app.services.product_images.storage.Client") as storage_client:
            response = self.client.post(
                "/api/products/",
                headers={"X-CSRF-Token": "image-upload-csrf-token"},
                data=data,
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("up to 10 images", response.json["error"])
        storage_client.assert_not_called()


if __name__ == "__main__":
    unittest.main()
