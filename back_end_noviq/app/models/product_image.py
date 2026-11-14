from app.extensions import db


class ProductImage(db.Model):
    __tablename__ = "product_images"

    product_image_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    product_id = db.Column(
        db.Integer,
        db.ForeignKey("products.product_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    image_url = db.Column(db.String(2048), nullable=False)
    display_order = db.Column(db.Integer, nullable=False, default=0, server_default="0")

    product = db.relationship("Product", back_populates="images")
