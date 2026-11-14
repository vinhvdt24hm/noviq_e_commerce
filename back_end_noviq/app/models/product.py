from app.extensions import db


class Product(db.Model):
    __tablename__ = "products"

    product_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    store_id = db.Column(
        db.Integer,
        db.ForeignKey("stores.store_id"),
        nullable=False,
        index=True,
    )
    category_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "categories.category_id",
            onupdate="CASCADE",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    product_name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    price = db.Column(db.Numeric(12, 2), nullable=False)
    image_url = db.Column(db.String(2048), nullable=True)
    stock = db.Column(
        db.Integer, nullable=False, default=0, server_default="0"
    )
    is_active = db.Column(
        db.Boolean, nullable=True, default=True, server_default=db.true()
    )
    created_at = db.Column(
        db.DateTime, nullable=True, server_default=db.func.current_timestamp()
    )
    category = db.relationship("Category")
    store = db.relationship("Store", back_populates="products")
    images = db.relationship(
        "ProductImage",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductImage.display_order",
        passive_deletes=True,
    )
    reviews = db.relationship(
        "ProductReview",
        back_populates="product",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ProductReview.created_at.desc()",
    )
