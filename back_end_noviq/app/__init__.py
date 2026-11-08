import hmac

from flask import Flask, jsonify, request, session
import click

from config import Config

from app.extensions import db, migrate, cors


def create_app():

    app = Flask(__name__)

    app.config.from_object(Config)

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(
        app,
        origins=app.config["CORS_ORIGINS"],
        supports_credentials=True,
        allow_headers=["Content-Type", "X-CSRF-Token"],
    )

    @app.before_request
    def validate_api_csrf():
        if (
            request.path.startswith("/api/")
            and request.method in {"POST", "PUT", "PATCH", "DELETE"}
        ):
            expected = session.get("csrf_token")
            supplied = request.headers.get("X-CSRF-Token", "")
            if not expected or not hmac.compare_digest(expected, supplied):
                return jsonify({"error": "Valid CSRF token required."}), 403

    from app import models
    from app.routes.auth_routes import auth_bp
    from app.routes.order_routes import order_bp
    from app.routes.product_routes import product_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(order_bp, url_prefix="/api/orders")
    app.register_blueprint(product_bp, url_prefix="/api/products")

    @app.cli.command("create-seller")
    @click.option("--email", prompt=True)
    @click.option("--full-name", prompt="Seller name")
    @click.password_option(confirmation_prompt=True)
    def create_seller(email, full_name, password):
        """Create a seller account or promote an existing user."""
        from werkzeug.security import generate_password_hash

        from app.models import User

        normalized_email = email.strip().lower()
        if (
            not full_name.strip()
            or "@" not in normalized_email
            or len(password) < 8
        ):
            raise click.ClickException(
                "Enter a seller name, a valid email, and a password with at least 8 characters."
            )

        user = User.query.filter_by(email=normalized_email).first()
        existing_seller = User.query.filter(
            User.role == "seller",
            User.email != normalized_email,
        ).first()
        if existing_seller is not None:
            raise click.ClickException(
                "This store supports one seller account. "
                f"The current seller account is {existing_seller.email}."
            )

        if user is None:
            user = User(
                email=normalized_email,
                full_name=full_name.strip(),
                password_hash=generate_password_hash(password),
            )
            db.session.add(user)
        else:
            user.full_name = full_name.strip()
            user.password_hash = generate_password_hash(password)
            user.is_active = True

        user.role = "seller"
        db.session.commit()
        click.echo(f"Seller account ready: {normalized_email}")

    return app