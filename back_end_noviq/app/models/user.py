from app.extensions import db


class User(db.Model):
    __tablename__ = "users"

    user_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    full_name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    is_active = db.Column(
        db.Boolean, nullable=False, default=True, server_default=db.true()
    )
    phone_number = db.Column(db.String(20), nullable=True)
    role = db.Column(
        db.String(20), nullable=False, default="customer", server_default="customer"
    )
    created_at = db.Column(
        db.DateTime, nullable=False, server_default=db.func.current_timestamp()
    )
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        server_default=db.func.current_timestamp(),
        onupdate=db.func.current_timestamp(),
    )

    store = db.relationship("Store", back_populates="owner", uselist=False)