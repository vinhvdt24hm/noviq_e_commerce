from app.extensions import db


class OrderRecord(db.Model):
    __tablename__ = "orders"

    order_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    store_id = db.Column(
        db.Integer,
        db.ForeignKey("stores.store_id"),
        nullable=False,
        index=True,
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.user_id"), nullable=False, index=True
    )
    order_number = db.Column(db.String(32), nullable=False, unique=True)
    checkout_id = db.Column(db.String(32), nullable=False, index=True)
    recipient_name = db.Column(db.String(255), nullable=False)
    phone_number = db.Column(db.String(20), nullable=False)
    shipping_address = db.Column(db.String(500), nullable=False)
    total_amount = db.Column(db.Numeric(12, 2), nullable=False)
    status = db.Column(
        db.String(20), nullable=False, default="pending", server_default="pending"
    )
    created_at = db.Column(
        db.DateTime, nullable=False, server_default=db.func.current_timestamp()
    )

    items = db.relationship(
        "OrderLine", back_populates="order", cascade="all, delete-orphan"
    )
    customer = db.relationship("User")
    store = db.relationship("Store", back_populates="orders")


class OrderLine(db.Model):
    __tablename__ = "order_items"

    order_item_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    order_id = db.Column(
        db.Integer, db.ForeignKey("orders.order_id", ondelete="CASCADE"), nullable=False
    )
    product_id = db.Column(
        db.Integer, db.ForeignKey("products.product_id", ondelete="SET NULL"), nullable=True
    )
    product_name = db.Column(db.String(150), nullable=False)
    image_url = db.Column(db.String(2048), nullable=True)
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Numeric(12, 2), nullable=False)

    order = db.relationship("OrderRecord", back_populates="items")