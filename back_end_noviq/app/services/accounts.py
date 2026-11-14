import re
import unicodedata

from werkzeug.security import generate_password_hash

from app.extensions import db
from app.models import Store, User


def store_slug_base(name):
    normalized = unicodedata.normalize("NFKD", name)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_name).strip("-")
    return slug or "store"


def validate_account_details(email, full_name, password):
    normalized_email = email.strip().lower()
    normalized_name = full_name.strip()
    if (
        not normalized_name
        or len(normalized_name) > 255
        or "@" not in normalized_email
        or len(normalized_email) > 150
        or len(password) < 8
    ):
        raise ValueError(
            "Enter a valid name and email, and a password with at least 8 characters."
        )
    return normalized_email, normalized_name


def create_seller_account(email, full_name, store_name, password):
    normalized_email, normalized_name = validate_account_details(
        email,
        full_name,
        password,
    )
    normalized_store_name = store_name.strip()
    if not normalized_store_name or len(normalized_store_name) > 150:
        raise ValueError("Enter a store name with at most 150 characters.")

    user = User.query.filter_by(email=normalized_email).first()
    if user is not None and user.role == "admin":
        raise ValueError("An admin account cannot be converted into a seller.")
    if user is not None and user.role == "seller" and user.store is not None:
        raise ValueError(f"This seller already owns the {user.store.name} store.")
    if user is not None and user.store is not None:
        raise ValueError("This account already owns a store.")

    if user is None:
        user = User(
            email=normalized_email,
            full_name=normalized_name,
            password_hash=generate_password_hash(password),
        )
        db.session.add(user)
    else:
        user.full_name = normalized_name
        user.password_hash = generate_password_hash(password)
        user.is_active = True
    user.role = "seller"
    db.session.flush()

    slug_base = store_slug_base(normalized_store_name)
    slug = slug_base
    suffix = 2
    while Store.query.filter_by(slug=slug).first() is not None:
        slug = f"{slug_base}-{suffix}"
        suffix += 1

    store = Store(
        owner_user_id=user.user_id,
        name=normalized_store_name,
        slug=slug,
    )
    db.session.add(store)
    db.session.commit()
    return user, store


def create_admin_account(email, full_name, password):
    normalized_email, normalized_name = validate_account_details(
        email,
        full_name,
        password,
    )
    if len(password) < 12:
        raise ValueError("Admin passwords must contain at least 12 characters.")

    user = User.query.filter_by(email=normalized_email).first()
    if user is not None and user.role != "customer":
        raise ValueError("This email already belongs to a non-customer account.")
    if user is not None and user.store is not None:
        raise ValueError("An account that owns a store cannot become an admin.")

    if user is None:
        user = User(
            email=normalized_email,
            full_name=normalized_name,
            password_hash=generate_password_hash(password),
        )
        db.session.add(user)
    else:
        user.full_name = normalized_name
        user.password_hash = generate_password_hash(password)
        user.is_active = True
    user.role = "admin"
    db.session.commit()
    return user
