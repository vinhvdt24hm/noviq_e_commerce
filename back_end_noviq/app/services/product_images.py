import logging
import warnings
from dataclasses import dataclass
from io import BytesIO
from urllib.parse import quote, urlsplit
from uuid import uuid4

from flask import current_app
from google.api_core.exceptions import GoogleAPICallError
from google.auth.exceptions import GoogleAuthError
from google.cloud import storage
from PIL import Image, ImageOps, UnidentifiedImageError


LOGGER = logging.getLogger(__name__)
MAX_PRODUCT_IMAGE_COUNT = 10
MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024
MAX_PRODUCT_IMAGE_TOTAL_SIZE = 25 * 1024 * 1024
MAX_PRODUCT_IMAGE_PIXELS = 25_000_000
IMAGE_FORMATS = {
    "JPEG": ("jpg", "image/jpeg"),
    "PNG": ("png", "image/png"),
    "WEBP": ("webp", "image/webp"),
}


class InvalidProductImage(ValueError):
    pass


class ProductImageStorageError(RuntimeError):
    pass


@dataclass(frozen=True)
class StoredProductImage:
    image_url: str
    object_name: str


def _normalize_image(file_storage):
    content = file_storage.stream.read(MAX_PRODUCT_IMAGE_SIZE + 1)
    if not content:
        raise InvalidProductImage("Image files cannot be empty.")
    if len(content) > MAX_PRODUCT_IMAGE_SIZE:
        raise InvalidProductImage("Each image must be 5 MB or smaller.")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as image:
                image_format = image.format
                if image_format not in IMAGE_FORMATS:
                    raise InvalidProductImage(
                        "Only JPEG, PNG, and WebP images are supported."
                    )
                if image.width * image.height > MAX_PRODUCT_IMAGE_PIXELS:
                    raise InvalidProductImage(
                        "Images must contain no more than 25 megapixels."
                    )
                if getattr(image, "is_animated", False):
                    raise InvalidProductImage(
                        "Animated images are not supported."
                    )
                image.verify()

            with Image.open(BytesIO(content)) as image:
                image.load()
                image = ImageOps.exif_transpose(image)
                has_alpha = (
                    "A" in image.getbands()
                    or "transparency" in image.info
                )
                if image_format == "JPEG":
                    image = image.convert("RGB")
                    save_options = {"quality": 88, "optimize": True}
                else:
                    image = image.convert("RGBA" if has_alpha else "RGB")
                    save_options = {"optimize": True}
                    if image_format == "WEBP":
                        save_options = {"quality": 88, "method": 6}

                normalized = BytesIO()
                image.save(
                    normalized,
                    format=image_format,
                    **save_options,
                )
    except InvalidProductImage:
        raise
    except (
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
        OSError,
        SyntaxError,
        UnidentifiedImageError,
        ValueError,
    ) as error:
        raise InvalidProductImage(
            "The uploaded file is not a valid supported image."
        ) from error

    normalized_content = normalized.getvalue()
    if len(normalized_content) > MAX_PRODUCT_IMAGE_SIZE:
        raise InvalidProductImage(
            "The processed image is larger than the 5 MB limit."
        )
    extension, content_type = IMAGE_FORMATS[image_format]
    return normalized_content, extension, content_type, len(content)


def _delete_objects(bucket, object_names):
    for object_name in object_names:
        try:
            bucket.blob(object_name).delete()
        except (GoogleAPICallError, GoogleAuthError, OSError):
            LOGGER.exception(
                "Could not remove uncommitted product image %s",
                object_name,
            )


def upload_product_images(files, store_id):
    if not files:
        return []
    if len(files) > MAX_PRODUCT_IMAGE_COUNT:
        raise InvalidProductImage("A product can have up to 10 images.")

    prepared_images = []
    total_size = 0
    for file_storage in files:
        image_content, extension, content_type, source_size = _normalize_image(
            file_storage
        )
        total_size += source_size
        if total_size > MAX_PRODUCT_IMAGE_TOTAL_SIZE:
            raise InvalidProductImage(
                "The combined image size must be 25 MB or smaller."
            )
        prepared_images.append((image_content, extension, content_type))

    bucket_name = current_app.config.get("PRODUCT_IMAGES_BUCKET")
    if not bucket_name:
        current_app.logger.error(
            "Product image upload requested without PRODUCT_IMAGES_BUCKET"
        )
        raise ProductImageStorageError(
            "Product image storage is not configured. "
            "Set PRODUCT_IMAGES_BUCKET before uploading."
        )
    base_url = (
        current_app.config.get("PRODUCT_IMAGES_PUBLIC_BASE_URL")
        or f"https://storage.googleapis.com/{bucket_name}"
    ).rstrip("/")
    try:
        parsed_base_url = urlsplit(base_url)
    except ValueError as error:
        current_app.logger.error(
            "PRODUCT_IMAGES_PUBLIC_BASE_URL is not a valid HTTPS URL"
        )
        raise ProductImageStorageError(
            "PRODUCT_IMAGES_PUBLIC_BASE_URL must be a valid HTTPS URL."
        ) from error
    if (
        parsed_base_url.scheme != "https"
        or not parsed_base_url.netloc
        or parsed_base_url.query
        or parsed_base_url.fragment
    ):
        current_app.logger.error(
            "PRODUCT_IMAGES_PUBLIC_BASE_URL is not a valid HTTPS URL"
        )
        raise ProductImageStorageError(
            "PRODUCT_IMAGES_PUBLIC_BASE_URL must be a valid HTTPS URL."
        )

    uploaded = []
    try:
        client = storage.Client()
        bucket = client.bucket(bucket_name)

        for image_content, extension, content_type in prepared_images:
            object_name = (
                f"stores/{store_id}/products/{uuid4().hex}.{extension}"
            )
            blob = bucket.blob(object_name)
            blob.upload_from_file(
                BytesIO(image_content),
                size=len(image_content),
                content_type=content_type,
                if_generation_match=0,
            )
            uploaded.append(
                StoredProductImage(
                    image_url=f"{base_url}/{quote(object_name, safe='/')}",
                    object_name=object_name,
                )
            )
    except (GoogleAPICallError, GoogleAuthError, OSError):
        if "bucket" in locals():
            _delete_objects(
                bucket,
                [image.object_name for image in uploaded],
            )
        LOGGER.exception(
            "Could not upload product images to the configured Cloud Storage bucket"
        )
        raise ProductImageStorageError(
            "Could not upload product images. Check Cloud Storage "
            "permissions and try again."
        ) from None

    return uploaded


def delete_uncommitted_product_images(object_names):
    if not object_names:
        return
    bucket_name = current_app.config.get("PRODUCT_IMAGES_BUCKET")
    if not bucket_name:
        LOGGER.error(
            "Cannot clean up uncommitted product images without "
            "PRODUCT_IMAGES_BUCKET"
        )
        return
    try:
        bucket = storage.Client().bucket(bucket_name)
        _delete_objects(bucket, object_names)
    except (GoogleAPICallError, GoogleAuthError, OSError):
        LOGGER.exception("Could not initialize Cloud Storage cleanup")
