from decimal import Decimal, InvalidOperation

from flask import Blueprint, jsonify, request

from app.extensions import db
from app.models import Category, Product
from app.routes.auth_routes import seller_required

product_bp = Blueprint(
    "products",
    __name__
)


def serialize_product(product):
    return {
        "id": product.product_id,
        "name": product.product_name,
        "category": product.category.category_name if product.category else "",
        "category_id": product.category_id,
        "price": float(product.price),
        "description": product.description or "",
        "image_url": product.image_url or "",
        "stock": product.stock,
        "is_active": product.is_active,
    }


def parse_product(data):
    if not isinstance(data, dict):
        return None, "A JSON request body is required."

    name = data.get("name")
    category_name = data.get("category", "")
    description = data.get("description", "")
    image_url = data.get("image_url", "")
    stock = data.get("stock", 0)
    if (
        not isinstance(name, str)
        or not name.strip()
        or len(name.strip()) > 150
        or not isinstance(category_name, str)
        or len(category_name.strip()) > 100
        or not isinstance(description, str)
        or not isinstance(image_url, str)
        or len(image_url) > 2048
        or not isinstance(stock, int)
        or isinstance(stock, bool)
        or stock < 0
        or stock > 2147483647
    ):
        return None, "Product fields are invalid."

    try:
        price = Decimal(str(data.get("price")))
    except (InvalidOperation, TypeError, ValueError):
        return None, "Price must be a positive number."
    if not price.is_finite() or price <= 0 or price >= Decimal("10000000000"):
        return None, "Price must be a positive number within supported limits."

    category = None
    if category_name.strip():
        category = Category.query.filter_by(
            category_name=category_name.strip()
        ).first()
        if category is None:
            category = Category(category_name=category_name.strip())
            db.session.add(category)
            db.session.flush()

    return {
        "product_name": name.strip(),
        "category": category,
        "description": description.strip() or None,
        "image_url": image_url.strip() or None,
        "price": price,
        "stock": stock,
    }, None


@product_bp.route("/", methods=["GET"])
def get_products():
    products = (
        Product.query.filter_by(is_active=True)
        .order_by(Product.product_id)
        .all()
    )

    return jsonify({
        "status": "success",
        "data": [serialize_product(product) for product in products],
    })


@product_bp.get("/<int:product_id>")
def get_product(product_id):
    product = Product.query.filter_by(
        product_id=product_id,
        is_active=True,
    ).first()
    if product is None:
        return jsonify({"error": "Product not found."}), 404

    return jsonify({"data": serialize_product(product)})


@product_bp.post("/")
@seller_required
def create_product():
    values, error = parse_product(request.get_json(silent=True))
    if error:
        return jsonify({"error": error}), 400

    product = Product(
        product_name=values["product_name"],
        category=values["category"],
        description=values["description"],
        image_url=values["image_url"],
        price=values["price"],
        stock=values["stock"],
        is_active=True,
    )
    db.session.add(product)
    db.session.commit()
    return jsonify({"data": serialize_product(product)}), 201


@product_bp.put("/<int:product_id>")
@seller_required
def update_product(product_id):
    product = Product.query.filter_by(product_id=product_id).first()
    if product is None:
        return jsonify({"error": "Product not found."}), 404

    values, error = parse_product(request.get_json(silent=True))
    if error:
        return jsonify({"error": error}), 400

    product.product_name = values["product_name"]
    product.category = values["category"]
    product.description = values["description"]
    product.image_url = values["image_url"]
    product.price = values["price"]
    product.stock = values["stock"]
    db.session.commit()
    return jsonify({"data": serialize_product(product)})


@product_bp.delete("/<int:product_id>")
@seller_required
def delete_product(product_id):
    product = Product.query.filter_by(product_id=product_id).first()
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

    product = Product.query.filter_by(product_id=product_id).first()
    if product is None:
        return jsonify({"error": "Product not found."}), 404
    product.stock = stock
    db.session.commit()
    return jsonify({"data": serialize_product(product)})