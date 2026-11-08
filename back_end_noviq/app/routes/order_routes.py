from decimal import Decimal
from uuid import uuid4

from flask import Blueprint, jsonify, request
from sqlalchemy import update

from app.extensions import db
from app.models import OrderLine, OrderRecord, Product
from app.routes.auth_routes import current_user, login_required, seller_required

order_bp = Blueprint("orders", __name__)
ORDER_STATUSES = {"pending", "processing", "shipped", "completed", "cancelled"}
ORDER_TRANSITIONS = {
    "pending": {"processing", "cancelled"},
    "processing": {"shipped", "cancelled"},
    "shipped": {"completed"},
    "completed": set(),
    "cancelled": set(),
}


def serialize_order(order):
    return {
        "id": order.order_number,
        "order_id": order.order_id,
        "customer": order.recipient_name,
        "phone_number": order.phone_number,
        "address": order.shipping_address,
        "date": order.created_at.isoformat() if order.created_at else None,
        "total": float(order.total_amount),
        "status": order.status,
        "items": [
            {
                "product_id": item.product_id,
                "name": item.product_name,
                "image_url": item.image_url,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price),
            }
            for item in order.items
        ],
    }


@order_bp.post("/")
@login_required
def create_order():
    user = current_user()
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "A JSON request body is required."}), 400

    recipient_name = data.get("recipient_name")
    phone_number = data.get("phone_number")
    shipping_address = data.get("shipping_address")
    items = data.get("items")
    if (
        not isinstance(recipient_name, str)
        or not recipient_name.strip()
        or len(recipient_name.strip()) > 255
        or not isinstance(phone_number, str)
        or not phone_number.strip()
        or len(phone_number.strip()) > 20
        or not isinstance(shipping_address, str)
        or not shipping_address.strip()
        or len(shipping_address.strip()) > 500
        or not isinstance(items, list)
        or not items
        or len(items) > 50
    ):
        return jsonify(
            {"error": "Valid shipping details and order items are required."}
        ), 400

    quantities = {}
    for item in items:
        if not isinstance(item, dict):
            return jsonify({"error": "Each order item must be an object."}), 400
        product_id = item.get("product_id")
        quantity = item.get("quantity")
        if (
            not isinstance(product_id, int)
            or isinstance(product_id, bool)
            or not isinstance(quantity, int)
            or isinstance(quantity, bool)
            or quantity < 1
            or quantity > 100
        ):
            return jsonify(
                {"error": "Product IDs and quantities must be valid integers."}
            ), 400
        quantities[product_id] = quantities.get(product_id, 0) + quantity
        if quantities[product_id] > 100:
            return jsonify({"error": "Maximum quantity per product is 100."}), 400

    products = {
        product.product_id: product
        for product in Product.query.filter(
            Product.product_id.in_(quantities),
            Product.is_active.is_(True),
        ).all()
    }
    if len(products) != len(quantities):
        return jsonify({"error": "One or more products are unavailable."}), 409

    total = sum(
        (Decimal(products[product_id].price) * quantity)
        for product_id, quantity in quantities.items()
    )
    if total >= Decimal("10000000000"):
        return jsonify({"error": "Order total exceeds the supported limit."}), 400

    order = OrderRecord(
        user_id=user.user_id,
        order_number=f"NQ-{uuid4().hex[:12].upper()}",
        recipient_name=recipient_name.strip(),
        phone_number=phone_number.strip(),
        shipping_address=shipping_address.strip(),
        total_amount=total,
        status="pending",
    )
    db.session.add(order)

    for product_id, quantity in quantities.items():
        product = products[product_id]
        result = db.session.execute(
            update(Product)
            .where(
                Product.product_id == product_id,
                Product.is_active.is_(True),
                Product.stock >= quantity,
            )
            .values(stock=Product.stock - quantity)
        )
        if result.rowcount != 1:
            db.session.rollback()
            return jsonify(
                {"error": f"Not enough stock for {product.product_name}."}
            ), 409

        order.items.append(
            OrderLine(
                product_id=product_id,
                product_name=product.product_name,
                image_url=product.image_url,
                quantity=quantity,
                unit_price=product.price,
            )
        )

    db.session.commit()
    return jsonify({"data": serialize_order(order)}), 201


@order_bp.get("/")
@login_required
def get_customer_orders():
    user = current_user()
    orders = (
        OrderRecord.query.filter_by(user_id=user.user_id)
        .order_by(OrderRecord.created_at.desc())
        .all()
    )
    return jsonify({"data": [serialize_order(order) for order in orders]})


@order_bp.get("/seller")
@seller_required
def get_seller_orders():
    orders = OrderRecord.query.order_by(OrderRecord.created_at.desc()).all()
    return jsonify({"data": [serialize_order(order) for order in orders]})


@order_bp.patch("/<int:order_id>/status")
@seller_required
def update_order_status(order_id):
    data = request.get_json(silent=True)
    status = data.get("status") if isinstance(data, dict) else None
    if not isinstance(status, str) or status not in ORDER_STATUSES:
        return jsonify({"error": "Invalid order status."}), 400

    order = (
        OrderRecord.query.filter_by(order_id=order_id)
        .with_for_update()
        .first()
    )
    if order is None:
        return jsonify({"error": "Order not found."}), 404

    allowed_transitions = ORDER_TRANSITIONS.get(order.status)
    if allowed_transitions is None or status not in allowed_transitions:
        return jsonify(
            {"error": f"Order cannot move from {order.status} to {status}."}
        ), 409

    if status == "cancelled":
        for item in order.items:
            if item.product_id is not None:
                result = db.session.execute(
                    update(Product)
                    .where(
                        Product.product_id == item.product_id,
                        Product.stock <= 2147483647 - item.quantity,
                    )
                    .values(stock=Product.stock + item.quantity)
                )
                if result.rowcount != 1:
                    db.session.rollback()
                    return jsonify(
                        {"error": "Inventory cannot be restored for this order."}
                    ), 409

    order.status = status
    db.session.commit()
    return jsonify({"data": serialize_order(order)})