import secrets
from functools import wraps

from flask import Blueprint, g, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db
from app.models import Store, User

auth_bp = Blueprint("auth", __name__)


def current_user():
    user_id = session.get("user_id")
    if user_id is None:
        return None
    return db_user_by_id(user_id)


def db_user_by_id(user_id):
    return User.query.filter_by(user_id=user_id, is_active=True).first()


def user_payload(user):
    payload = {
        "id": user.user_id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
    }
    if user.role == "seller" and user.store is not None:
        payload["store"] = {
            "id": user.store.store_id,
            "name": user.store.name,
            "slug": user.store.slug,
        }
    return payload


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = current_user()
        if user is None:
            return jsonify({"error": "Authentication required."}), 401
        return view(*args, **kwargs)

    return wrapped


def seller_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = current_user()
        if user is None:
            return jsonify({"error": "Authentication required."}), 401
        if user.role != "seller":
            return jsonify({"error": "Seller permission required."}), 403
        store = Store.query.filter_by(
            owner_user_id=user.user_id,
            is_active=True,
        ).first()
        if store is None:
            return jsonify(
                {"error": "An active seller store is required."}
            ), 403
        g.seller_store = store
        return view(*args, **kwargs)

    return wrapped


@auth_bp.get("/csrf")
def get_csrf_token():
    token = session.get("csrf_token")
    if token is None:
        token = secrets.token_urlsafe(32)
        session["csrf_token"] = token
    return jsonify({"csrf_token": token})


@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "A JSON request body is required."}), 400

    full_name = data.get("full_name")
    email = data.get("email")
    password = data.get("password")
    if not all(isinstance(value, str) for value in (full_name, email, password)):
        return jsonify({"error": "Name, email, and password are required."}), 400

    full_name = full_name.strip()
    email = email.strip().lower()
    if not full_name or len(full_name) > 255 or "@" not in email or len(email) > 150:
        return jsonify({"error": "Enter a valid name and email address."}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must contain at least 8 characters."}), 400
    if User.query.filter_by(email=email).first() is not None:
        return jsonify({"error": "An account with this email already exists."}), 409

    user = User(
        full_name=full_name,
        email=email,
        password_hash=generate_password_hash(password),
        role="customer",
    )
    db.session.add(user)
    db.session.commit()
    session.clear()
    session["user_id"] = user.user_id
    return jsonify({"data": user_payload(user)}), 201


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "A JSON request body is required."}), 400

    email = data.get("email")
    password = data.get("password")
    if not isinstance(email, str) or not isinstance(password, str):
        return jsonify({"error": "Email and password are required."}), 400

    user = User.query.filter_by(email=email.strip().lower()).first()
    if (
        user is None
        or not user.is_active
        or not check_password_hash(user.password_hash, password)
    ):
        return jsonify({"error": "Email or password is incorrect."}), 401
    if user.role == "admin":
        return jsonify({"error": "Use the admin sign-in page."}), 403

    session.clear()
    session["user_id"] = user.user_id
    return jsonify({"data": user_payload(user)})


@auth_bp.post("/logout")
def logout():
    session.clear()
    return jsonify({"status": "success"})


@auth_bp.get("/me")
def get_current_user():
    user = current_user()
    if user is None:
        return jsonify({"data": None})
    return jsonify({"data": user_payload(user)})
