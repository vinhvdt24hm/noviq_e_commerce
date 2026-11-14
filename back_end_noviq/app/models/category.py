from app.extensions import db


class Category(db.Model):
    __tablename__ = "categories"

    category_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    category_name = db.Column(db.String(100), nullable=False)
    parent_id = db.Column(
        db.Integer,
        db.ForeignKey("categories.category_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    description = db.Column(db.Text, nullable=True)
    is_active = db.Column(
        db.Boolean, nullable=False, default=True, server_default=db.true()
    )
    created_at = db.Column(
        db.DateTime, nullable=False, server_default=db.func.current_timestamp()
    )
    parent = db.relationship(
        "Category",
        remote_side=[category_id],
        back_populates="children",
    )
    children = db.relationship(
        "Category",
        back_populates="parent",
        order_by="Category.category_name",
    )
