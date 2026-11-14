import json
from decimal import Decimal, InvalidOperation
from urllib.parse import urlsplit

from flask import Blueprint, current_app, g, jsonify, request
from sqlalchemy import or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import joinedload, selectinload

from app.extensions import db
from app.models import Category, Product, ProductImage, Store
from app.routes.auth_routes import seller_required
from app.services.product_images import (
    InvalidProductImage,
    ProductImageStorageError,
    delete_uncommitted_product_images,
    upload_product_images,
)

product_bp = Blueprint(
    "products",
    __name__
)

DEFAULT_PRODUCT_PAGE_SIZE = 12
MAX_PRODUCT_PAGE_SIZE = 50
MAX_PRODUCT_IMAGES = 10
PRODUCT_SORT_OPTIONS = {"featured", "priceAsc", "priceDesc"}


def is_valid_image_url(value):
    try:
        parsed_url = urlsplit(value.strip())
    except ValueError:
        return False
    return parsed_url.scheme in {"http", "https"} and bool(parsed_url.netloc)


def serialize_product(product):
    images = [image.image_url for image in product.images]
    if not images and product.image_url:
        images = [product.image_url]

    return {
        "id": product.product_id,
        "name": product.product_name,
        "category": product.category.category_name if product.category else "",
        "category_id": product.category_id,
        "price": float(product.price),
        "description": product.description or "",
        "image_url": product.image_url or "",
        "images": images,
        "stock": product.stock,
        "is_active": product.is_active,
        "store": {
            "id": product.store.store_id,
            "name": product.store.name,
            "slug": product.store.slug,
        },
    }


def parse_product(data):
    if not isinstance(data, dict):
        return None, "A JSON request body is required."

    name = data.get("name")
    category_name = data.get("category", "")
    description = data.get("description", "")
    stock = data.get("stock", 0)
    if (
        not isinstance(name, str)
        or not name.strip()
        or len(name.strip()) > 150
        or not isinstance(category_name, str)
        or len(category_name.strip()) > 100
        or not isinstance(description, str)
        or not isinstance(stock, int)
        or isinstance(stock, bool)
        or stock < 0
        or stock > 2147483647
    ):
        return None, "Product fields are invalid."

    if "image_urls" in data:
        raw_image_urls = data["image_urls"]
        if (
            not isinstance(raw_image_urls, list)
            or len(raw_image_urls) > MAX_PRODUCT_IMAGES
            or any(
                not isinstance(image_url, str)
                or not image_url.strip()
                or len(image_url.strip()) > 2048
                or not is_valid_image_url(image_url)
                for image_url in raw_image_urls
            )
        ):
            return None, (
                "image_urls must contain up to 10 valid HTTP or HTTPS URLs."
            )
        image_urls = [image_url.strip() for image_url in raw_image_urls]
        if len(set(image_urls)) != len(image_urls):
            return None, "image_urls must not contain duplicate URLs."
    else:
        image_url = data.get("image_url", "")
        if not isinstance(image_url, str) or len(image_url) > 2048:
            return None, "Product fields are invalid."
        image_urls = [image_url.strip()] if image_url.strip() else []

    try:
        price = Decimal(str(data.get("price")))
    except (InvalidOperation, TypeError, ValueError):
        return None, "Price must be a positive number."
    if not price.is_finite() or price <= 0 or price >= Decimal("10000000000"):
        return None, "Price must be a positive number within supported limits."

    category = None
    category_id = data.get("category_id")
    if category_id is not None:
        if (
            not isinstance(category_id, int)
            or isinstance(category_id, bool)
            or category_id < 1
        ):
            return None, "Choose a valid product category."
        category = Category.query.filter_by(
            category_id=category_id,
            is_active=True,
        ).first()
        if category is None:
            return None, "Choose a valid product category."
    elif category_name.strip():
        matching_categories = Category.query.filter_by(
            category_name=category_name.strip(),
            is_active=True,
        ).all()
        if len(matching_categories) != 1:
            return None, "Choose a category by ID from the category list."
        category = matching_categories[0]

    return {
        "product_name": name.strip(),
        "category": category,
        "description": description.strip() or None,
        "image_url": image_urls[0] if image_urls else None,
        "image_urls": image_urls,
        "price": price,
        "stock": stock,
    }, None


def parse_product_submission():
    if request.mimetype == "multipart/form-data":
        raw_product = request.form.get("product")
        if raw_product is None:
            return None, [], "A product form field is required.", 400
        try:
            data = json.loads(raw_product)
        except (json.JSONDecodeError, TypeError):
            return None, [], "The product form field must contain valid JSON.", 400
        image_files = [
            file_storage
            for file_storage in request.files.getlist("images")
            if file_storage and file_storage.filename
        ]
    else:
        data = request.get_json(silent=True)
        image_files = []

    values, error = parse_product(data)
    if error:
        return None, [], error, 400
    if len(values["image_urls"]) + len(image_files) > MAX_PRODUCT_IMAGES:
        return None, [], "A product can have up to 10 images.", 400

    return values, image_files, None, None


def upload_submission_images(values, image_files):
    if not image_files:
        return [], None
    try:
        uploaded_images = upload_product_images(
            image_files,
            g.seller_store.store_id,
        )
    except InvalidProductImage as error:
        db.session.rollback()
        return [], (jsonify({"error": str(error)}), 400)
    except ProductImageStorageError as error:
        db.session.rollback()
        return [], (jsonify({"error": str(error)}), 503)

    values["image_urls"].extend(
        image.image_url for image in uploaded_images
    )
    values["image_url"] = (
        values["image_urls"][0] if values["image_urls"] else None
    )
    return uploaded_images, None


def commit_product(product, uploaded_images, status_code=200):
    try:
        db.session.add(product)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        delete_uncommitted_product_images(
            [image.object_name for image in uploaded_images or []]
        )
        current_app.logger.exception("Could not save product")
        return jsonify({"error": "Could not save product. Please try again."}), 500
    return jsonify({"data": serialize_product(product)}), status_code


def parse_positive_query_int(name, default, maximum=None):
    raw_value = request.args.get(name)
    if raw_value is None:
        return default, None

    try:
        value = int(raw_value)
    except ValueError:
        return None, f"{name} must be a positive integer."

    if value < 1 or (maximum is not None and value > maximum):
        if maximum is not None:
            return None, f"{name} must be between 1 and {maximum}."
        return None, f"{name} must be a positive integer."

    return value, None


def get_active_product_categories(store_id=None):
    query = (
        db.session.query(Category.category_name)
        .join(Product, Product.category_id == Category.category_id)
        .filter(
            Product.is_active.is_(True),
            Product.store.has(Store.is_active.is_(True)),
        )
    )
    if store_id is not None:
        query = query.filter(Product.store_id == store_id)
    rows = query.distinct().order_by(Category.category_name).all()
    return [category_name for (category_name,) in rows]


def get_category_descendant_ids(category_id):
    rows = db.session.query(Category.category_id, Category.parent_id).all()
    children_by_parent = {}
    for child_id, parent_id in rows:
        if parent_id is not None:
            children_by_parent.setdefault(parent_id, []).append(child_id)

    descendant_ids = []
    pending_ids = [category_id]
    while pending_ids:
        current_id = pending_ids.pop()
        descendant_ids.append(current_id)
        pending_ids.extend(children_by_parent.get(current_id, []))
    return descendant_ids


@product_bp.get("/categories")
def get_categories():
    categories = (
        Category.query.filter_by(is_active=True)
        .order_by(Category.category_name, Category.category_id)
        .all()
    )
    nodes = {
        category.category_id: {
            "id": category.category_id,
            "name": category.category_name,
            "parent_id": category.parent_id,
            "children": [],
        }
        for category in categories
    }
    roots = []
    for category in categories:
        node = nodes[category.category_id]
        parent = nodes.get(category.parent_id)
        if parent is None:
            roots.append(node)
        else:
            parent["children"].append(node)
    return jsonify({"data": roots})


@product_bp.route("/", methods=["GET"])
def get_products():
    pagination_keys = {
        "page", "per_page", "search", "category", "category_id", "sort"
    }
    store_slug = request.args.get("store", "").strip()
    if len(store_slug) > 180:
        return jsonify({"error": "store must be 180 characters or fewer."}), 400
    store = None
    if store_slug:
        store = Store.query.filter_by(slug=store_slug, is_active=True).first()
        if store is None:
            return jsonify({"error": "Store not found."}), 404

    category_id, error = parse_positive_query_int("category_id", None)
    if error:
        return jsonify({"error": error}), 400
    selected_category = None
    if category_id is not None:
        selected_category = Category.query.filter_by(
            category_id=category_id,
            is_active=True,
        ).first()
        if selected_category is None:
            return jsonify({"error": "Category not found."}), 404

    if not pagination_keys.intersection(request.args.keys()):
        products = (
            Product.query.options(
                joinedload(Product.category),
                joinedload(Product.store),
                selectinload(Product.images),
            )
            .filter(
                Product.is_active.is_(True),
                Product.store.has(Store.is_active.is_(True)),
            )
            .order_by(Product.product_id)
        )
        if store is not None:
            products = products.filter(Product.store_id == store.store_id)
        products = products.all()
        return jsonify({
            "status": "success",
            "data": [serialize_product(product) for product in products],
        })

    page, error = parse_positive_query_int("page", 1)
    if error:
        return jsonify({"error": error}), 400

    per_page, error = parse_positive_query_int(
        "per_page",
        DEFAULT_PRODUCT_PAGE_SIZE,
        maximum=MAX_PRODUCT_PAGE_SIZE,
    )
    if error:
        return jsonify({"error": error}), 400

    search = request.args.get("search", "").strip()
    category = request.args.get("category", "").strip()
    sort = request.args.get("sort", "featured")
    if len(search) > 100:
        return jsonify({"error": "search must be 100 characters or fewer."}), 400
    if len(category) > 100:
        return jsonify({"error": "category must be 100 characters or fewer."}), 400
    if sort not in PRODUCT_SORT_OPTIONS:
        return jsonify({
            "error": "sort must be one of: featured, priceAsc, priceDesc."
        }), 400

    query = (
        Product.query.options(
            joinedload(Product.category),
            joinedload(Product.store),
            selectinload(Product.images),
        )
        .filter(
            Product.is_active.is_(True),
            Product.store.has(Store.is_active.is_(True)),
        )
    )
    if store is not None:
        query = query.filter(Product.store_id == store.store_id)
    if selected_category is not None:
        query = query.filter(
            Product.category_id.in_(
                get_category_descendant_ids(selected_category.category_id)
            )
        )
    elif category:
        query = query.filter(
            Product.category.has(Category.category_name == category)
        )
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Product.product_name.ilike(search_pattern),
                Product.category.has(
                    Category.category_name.ilike(search_pattern)
                ),
            )
        )

    if sort == "priceAsc":
        query = query.order_by(Product.price.asc(), Product.product_id.asc())
    elif sort == "priceDesc":
        query = query.order_by(Product.price.desc(), Product.product_id.asc())
    else:
        query = query.order_by(Product.product_id.asc())

    result = query.paginate(
        page=page,
        per_page=per_page,
        error_out=False,
    )

    return jsonify({
        "status": "success",
        "data": [serialize_product(product) for product in result.items],
        "pagination": {
            "page": result.page,
            "per_page": result.per_page,
            "total_items": result.total,
            "total_pages": result.pages,
            "has_next": result.has_next,
            "has_prev": result.has_prev,
        },
            "categories": get_active_product_categories(
                store.store_id if store is not None else None
            ),
    })


@product_bp.get("/seller")
@seller_required
def get_seller_products():
    products = (
        Product.query.options(
            joinedload(Product.category),
            joinedload(Product.store),
            selectinload(Product.images),
        )
        .filter_by(store_id=g.seller_store.store_id)
        .order_by(Product.product_id.desc())
        .all()
    )
    return jsonify({"data": [serialize_product(product) for product in products]})


@product_bp.get("/<int:product_id>")
def get_product(product_id):
    product = (
        Product.query.options(
            joinedload(Product.category),
            joinedload(Product.store),
            selectinload(Product.images),
        )
        .filter_by(product_id=product_id, is_active=True)
        .filter(Product.store.has(Store.is_active.is_(True)))
        .first()
    )
    if product is None:
        return jsonify({"error": "Product not found."}), 404

    return jsonify({"data": serialize_product(product)})


@product_bp.post("/")
@seller_required
def create_product():
    values, image_files, error, status_code = parse_product_submission()
    if error:
        return jsonify({"error": error}), status_code
    uploaded_images, error_response = upload_submission_images(
        values,
        image_files,
    )
    if error_response:
        return error_response

    product = Product(
        product_name=values["product_name"],
        store=g.seller_store,
        category=values["category"],
        description=values["description"],
        image_url=values["image_url"],
        price=values["price"],
        stock=values["stock"],
        is_active=True,
        images=[
            ProductImage(image_url=image_url, display_order=index)
            for index, image_url in enumerate(values["image_urls"])
        ],
    )
    return commit_product(product, uploaded_images, status_code=201)


@product_bp.put("/<int:product_id>")
@seller_required
def update_product(product_id):
    product = Product.query.filter_by(
        product_id=product_id,
        store_id=g.seller_store.store_id,
    ).first()
    if product is None:
        return jsonify({"error": "Product not found."}), 404

    values, image_files, error, status_code = parse_product_submission()
    if error:
        return jsonify({"error": error}), status_code
    uploaded_images, error_response = upload_submission_images(
        values,
        image_files,
    )
    if error_response:
        return error_response

    product.product_name = values["product_name"]
    product.category = values["category"]
    product.description = values["description"]
    product.image_url = values["image_url"]
    product.price = values["price"]
    product.stock = values["stock"]
    product.images = [
        ProductImage(image_url=image_url, display_order=index)
        for index, image_url in enumerate(values["image_urls"])
    ]
    return commit_product(product, uploaded_images)


@product_bp.delete("/<int:product_id>")
@seller_required
def delete_product(product_id):
    product = Product.query.filter_by(
        product_id=product_id,
        store_id=g.seller_store.store_id,
    ).first()
    if product is None:
        return jsonify({"error": "Product not found."}), 404
    product.is_active = False
    db.session.commit()
    return jsonify({"status": "success"})


@product_bp.patch("/<int:product_id>/stock")
@seller_required
def update_product_stock(product_id):
    data = request.get_json(silent=True)
    stock = data.get("stock") if isinstance(data, dict) else None
    if (
        not isinstance(stock, int)
        or isinstance(stock, bool)
        or stock < 0
        or stock > 2147483647
    ):
        return jsonify({"error": "Stock must be a non-negative integer."}), 400

    product = Product.query.filter_by(
        product_id=product_id,
        store_id=g.seller_store.store_id,
    ).first()
    if product is None:
        return jsonify({"error": "Product not found."}), 404
    product.stock = stock
    db.session.commit()
    return jsonify({"data": serialize_product(product)})