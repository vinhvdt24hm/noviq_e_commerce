from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import Product, ProductReview, Store
from app.routes.auth_routes import current_user, login_required


reviews_bp = Blueprint("reviews", __name__)
MAX_REVIEW_COMMENT_LENGTH = 1000


def get_reviewable_product(product_id):
    return (
        Product.query.options(joinedload(Product.store))
        .filter_by(product_id=product_id, is_active=True)
        .filter(Product.store.has(Store.is_active.is_(True)))
        .first()
    )


def serialize_review(review):
    return {
        "id": review.review_id,
        "name": review.reviewer_name,
        "comment": review.comment,
        "rating": review.rating,
        "createdAt": review.created_at.isoformat() if review.created_at else None,
    }


@reviews_bp.get("/<int:product_id>/reviews")
def get_product_reviews(product_id):
    product = get_reviewable_product(product_id)
    if product is None:
        return jsonify({"error": "Product not found."}), 404

    reviews = (
        ProductReview.query.filter_by(product_id=product_id)
        .order_by(ProductReview.created_at.desc(), ProductReview.review_id.desc())
        .all()
    )
    count, average = db.session.query(
        func.count(ProductReview.review_id),
        func.avg(ProductReview.rating),
    ).filter_by(product_id=product_id).one()

    user = current_user()
    return jsonify({
        "data": [serialize_review(review) for review in reviews],
        "summary": {
            "count": count,
            "average": float(average) if average is not None else 0,
        },
        "current_user_reviewed": bool(
            user
            and ProductReview.query.filter_by(
                product_id=product_id,
                user_id=user.user_id,
            ).first()
        ),
    })


@reviews_bp.post("/<int:product_id>/reviews")
@login_required
def create_product_review(product_id):
    user = current_user()
    if user.role != "customer":
        return jsonify({"error": "Only customer accounts can submit reviews."}), 403

    product = get_reviewable_product(product_id)
    if product is None:
        return jsonify({"error": "Product not found."}), 404

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "A JSON request body is required."}), 400

    rating = data.get("rating")
    comment = data.get("comment")
    if (
        not isinstance(rating, int)
        or isinstance(rating, bool)
        or rating < 1
        or rating > 5
    ):
        return jsonify({"error": "Rating must be an integer from 1 to 5."}), 400
    if (
        not isinstance(comment, str)
        or not comment.strip()
        or len(comment.strip()) > MAX_REVIEW_COMMENT_LENGTH
    ):
        return jsonify({
            "error": "Comment must contain 1 to 1000 characters."
        }), 400

    review = ProductReview(
        product_id=product.product_id,
        user_id=user.user_id,
        reviewer_name=user.full_name,
        rating=rating,
        comment=comment.strip(),
    )
    try:
        db.session.add(review)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Could not save product review")
        return jsonify({"error": "Could not save review. Please try again."}), 500

    return jsonify({"data": serialize_review(review)}), 201