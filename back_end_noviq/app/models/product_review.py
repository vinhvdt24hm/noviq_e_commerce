from app.extensions import db


class ProductReview(db.Model):
    __tablename__ = "product_reviews"
    __table_args__ = (
        db.CheckConstraint(
            "rating >= 1 AND rating <= 5",
            name="ck_product_reviews_rating_range",
        ),
    )

    review_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    product_id = db.Column(
        db.Integer,
        db.ForeignKey("products.product_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.user_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reviewer_name = db.Column(db.String(255), nullable=False)
    rating = db.Column(db.SmallInteger, nullable=False)
    comment = db.Column(db.Text, nullable=False)
    created_at = db.Column(
        db.DateTime,
        nullable=False,
        server_default=db.func.current_timestamp(),
    )

    product = db.relationship("Product", back_populates="reviews")
    author = db.relationship("User")