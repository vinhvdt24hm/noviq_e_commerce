import hmac

from flask import Flask, jsonify, request, session
from werkzeug.exceptions import RequestEntityTooLarge
import click

from config import Config

from app.extensions import db, migrate, cors


def create_app(test_config=None):

    app = Flask(__name__)

    app.config.from_object(Config)
    if test_config is not None:
        app.config.update(test_config)

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

    @app.errorhandler(RequestEntityTooLarge)
    def handle_large_request(error):
        if request.path.startswith("/api/"):
            return jsonify({
                "error": "Request is too large. Product image uploads are limited to 25 MB."
            }), 413
        return jsonify({"error": "Request is too large."}), 413

    from app import models
    from app.routes.auth_routes import auth_bp
    from app.routes.admin_routes import admin_bp
    from app.routes.order_routes import order_bp
    from app.routes.product_routes import product_bp
    from app.routes.review_routes import reviews_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(order_bp, url_prefix="/api/orders")
    app.register_blueprint(product_bp, url_prefix="/api/products")
    app.register_blueprint(reviews_bp, url_prefix="/api/products")
    app.register_blueprint(admin_bp)

    @app.cli.command("create-seller")
    @click.option("--email", prompt=True)
    @click.option("--full-name", prompt="Seller name")
    @click.option("--store-name", prompt="Store name")
    @click.password_option(confirmation_prompt=True)
    def create_seller(email, full_name, store_name, password):
        """Create a seller account and its store."""
        from app.services.accounts import create_seller_account

        try:
            user, store = create_seller_account(
                email,
                full_name,
                store_name,
                password,
            )
        except ValueError as error:
            raise click.ClickException(str(error)) from error
        click.echo(f"Seller account ready: {user.email} ({store.slug})")

    @app.cli.command("create-admin")
    @click.option("--email", prompt=True)
    @click.option("--full-name", prompt="Admin name")
    @click.option(
        "--password",
        prompt=True,
        hide_input=True,
        confirmation_prompt=True,
        envvar="ADMIN_BOOTSTRAP_PASSWORD",
    )
    def create_admin(email, full_name, password):
        """Create an admin account or promote an existing customer."""
        from app.services.accounts import create_admin_account

        try:
            user = create_admin_account(email, full_name, password)
        except ValueError as error:
            raise click.ClickException(str(error)) from error
        click.echo(f"Admin account ready: {user.email}")

    return app