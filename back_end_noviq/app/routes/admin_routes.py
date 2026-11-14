from datetime import date, datetime
import hmac
import secrets
from functools import wraps

from flask import (
    Blueprint,
    abort,
    flash,
    g,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload
from werkzeug.security import check_password_hash

from app.extensions import db
from app.models import Category, OrderLine, OrderRecord, Product, Store, User
from app.routes.auth_routes import current_user
from app.services.accounts import create_seller_account

admin_bp = Blueprint("admin", __name__)


def get_csrf_token():
    token = session.get("csrf_token")
    if token is None:
        token = secrets.token_urlsafe(32)
        session["csrf_token"] = token
    return token


def get_category_path(category):
    names = []
    current = category
    while current is not None:
        names.append(current.category_name)
        current = current.parent
    return " / ".join(reversed(names))


@admin_bp.before_request
def validate_admin_csrf():
    if request.method != "POST":
        return None

    expected = session.get("csrf_token", "")
    supplied = request.form.get("csrf_token", "")
    if not expected or not hmac.compare_digest(expected, supplied):
        return render_template(
            "admin/error.html",
            status=403,
            message="Biểu mẫu đã hết hạn. Vui lòng tải lại trang và thử lại.",
        ), 403
    return None


def admin_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = current_user()
        if user is None:
            return redirect(url_for("admin.admin_login"))
        if user.role != "admin":
            abort(403)
        g.admin_user = user
        return view(*args, **kwargs)

    return wrapped


@admin_bp.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    user = current_user()
    if user is not None and user.role == "admin":
        return redirect(url_for("admin.admin_dashboard"))

    error = ""
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        user = User.query.filter_by(email=email).first()
        if (
            user is None
            or user.role != "admin"
            or not user.is_active
            or not check_password_hash(user.password_hash, password)
        ):
            error = "Email hoặc mật khẩu không chính xác."
        else:
            session.clear()
            session["user_id"] = user.user_id
            get_csrf_token()
            return redirect(url_for("admin.admin_dashboard"))

    return render_template(
        "admin/login.html",
        csrf_token=get_csrf_token(),
        error=error,
    )


@admin_bp.post("/admin/logout")
@admin_required
def admin_logout():
    session.clear()
    return redirect(url_for("admin.admin_login"))


@admin_bp.get("/admin")
@admin_required
def admin_dashboard():
    store_sales = {
        store_id: {
            "completed_orders": completed_orders,
            "revenue": revenue or 0,
        }
        for store_id, completed_orders, revenue in (
            db.session.query(
                OrderRecord.store_id,
                func.count(OrderRecord.order_id),
                func.sum(OrderRecord.total_amount),
            )
            .filter(OrderRecord.status == "completed")
            .group_by(OrderRecord.store_id)
            .all()
        )
    }

    completed_orders = sum(
        stats["completed_orders"] for stats in store_sales.values()
    )
    total_revenue = sum(
        (stats["revenue"] for stats in store_sales.values()),
        start=0,
    )
    total_stores = Store.query.count()
    active_stores = Store.query.filter_by(is_active=True).count()
    total_products = Product.query.count()
    active_products = Product.query.filter_by(is_active=True).count()

    today = date.today()
    current_month_index = today.year * 12 + today.month - 1
    chart_months = []
    for offset in range(5, -1, -1):
        month_index = current_month_index - offset
        year, month_zero_based = divmod(month_index, 12)
        month = month_zero_based + 1
        chart_months.append(
            {
                "key": (year, month),
                "label": f"{month:02d}/{str(year)[-2:]}",
                "revenue": 0.0,
                "orders": 0,
            }
        )

    month_by_key = {month["key"]: month for month in chart_months}
    chart_start = datetime(
        chart_months[0]["key"][0],
        chart_months[0]["key"][1],
        1,
    )
    chart_end = (
        datetime(today.year + 1, 1, 1)
        if today.month == 12
        else datetime(today.year, today.month + 1, 1)
    )
    recent_completed_orders = (
        db.session.query(OrderRecord.created_at, OrderRecord.total_amount)
        .filter(
            OrderRecord.status == "completed",
            OrderRecord.created_at >= chart_start,
            OrderRecord.created_at < chart_end,
        )
        .all()
    )
    for created_at, amount in recent_completed_orders:
        month = month_by_key.get((created_at.year, created_at.month))
        if month is not None:
            month["revenue"] += float(amount or 0)
            month["orders"] += 1

    max_monthly_revenue = max(
        (month["revenue"] for month in chart_months),
        default=0,
    )
    max_monthly_orders = max(
        (month["orders"] for month in chart_months),
        default=0,
    )
    for month in chart_months:
        month["revenue_percent"] = (
            month["revenue"] / max_monthly_revenue * 100
            if max_monthly_revenue
            else 0
        )
        month["orders_percent"] = (
            month["orders"] / max_monthly_orders * 100
            if max_monthly_orders
            else 0
        )

    total_customers = User.query.filter_by(role="customer").count()
    active_customers = User.query.filter_by(
        role="customer",
        is_active=True,
    ).count()

    return render_template(
        "admin/dashboard.html",
        admin=g.admin_user,
        csrf_token=get_csrf_token(),
        total_stores=total_stores,
        active_stores=active_stores,
        total_products=total_products,
        active_products=active_products,
        completed_orders=completed_orders,
        total_revenue=total_revenue,
        chart_months=chart_months,
        total_customers=total_customers,
        active_customers=active_customers,
    )


@admin_bp.get("/admin/stores")
@admin_required
def admin_stores():
    search = request.args.get("q", "").strip()[:100]
    status = request.args.get("status", "all")
    page = max(request.args.get("page", 1, type=int), 1)

    stores_query = Store.query.options(joinedload(Store.owner))
    if search:
        search_pattern = f"%{search}%"
        stores_query = stores_query.filter(
            or_(
                Store.name.ilike(search_pattern),
                Store.slug.ilike(search_pattern),
                Store.owner.has(
                    or_(
                        User.full_name.ilike(search_pattern),
                        User.email.ilike(search_pattern),
                    )
                ),
            )
        )
    if status == "active":
        stores_query = stores_query.filter(Store.is_active.is_(True))
    elif status == "inactive":
        stores_query = stores_query.filter(Store.is_active.is_(False))
    else:
        status = "all"

    stores = stores_query.order_by(
        Store.created_at.desc(),
        Store.store_id.desc(),
    ).paginate(page=page, per_page=20, error_out=False)

    store_ids = [store.store_id for store in stores.items]
    product_counts = {}
    store_sales = {}
    if store_ids:
        product_counts = dict(
            db.session.query(Product.store_id, func.count(Product.product_id))
            .filter(Product.store_id.in_(store_ids))
            .group_by(Product.store_id)
            .all()
        )
        store_sales = {
            store_id: {
                "completed_orders": completed_orders,
                "revenue": revenue or 0,
            }
            for store_id, completed_orders, revenue in (
                db.session.query(
                    OrderRecord.store_id,
                    func.count(OrderRecord.order_id),
                    func.sum(OrderRecord.total_amount),
                )
                .filter(
                    OrderRecord.store_id.in_(store_ids),
                    OrderRecord.status == "completed",
                )
                .group_by(OrderRecord.store_id)
                .all()
            )
        }

    return render_template(
        "admin/stores.html",
        admin=g.admin_user,
        csrf_token=get_csrf_token(),
        stores=stores,
        product_counts=product_counts,
        store_sales=store_sales,
        search=search,
        status=status,
        total_stores=Store.query.count(),
        active_stores=Store.query.filter_by(is_active=True).count(),
    )


@admin_bp.get("/admin/products")
@admin_required
def admin_products():
    search = request.args.get("q", "").strip()[:100]
    status = request.args.get("status", "all")
    page = max(request.args.get("page", 1, type=int), 1)

    products_query = Product.query.options(
        joinedload(Product.store).joinedload(Store.owner)
    )
    if search:
        search_pattern = f"%{search}%"
        products_query = products_query.filter(
            or_(
                Product.product_name.ilike(search_pattern),
                Product.store.has(
                    or_(
                        Store.name.ilike(search_pattern),
                        Store.slug.ilike(search_pattern),
                    )
                ),
            )
        )
    if status == "active":
        products_query = products_query.filter(Product.is_active.is_(True))
    elif status == "inactive":
        products_query = products_query.filter(
            or_(
                Product.is_active.is_(False),
                Product.is_active.is_(None),
            )
        )
    else:
        status = "all"

    products = products_query.order_by(
        Product.created_at.desc(),
        Product.product_id.desc(),
    ).paginate(page=page, per_page=20, error_out=False)

    product_ids = [product.product_id for product in products.items]
    product_sales = {}
    if product_ids:
        product_sales = {
            product_id: {
                "units_sold": units_sold or 0,
                "revenue": revenue or 0,
            }
            for product_id, units_sold, revenue in (
                db.session.query(
                    OrderLine.product_id,
                    func.sum(OrderLine.quantity),
                    func.sum(OrderLine.quantity * OrderLine.unit_price),
                )
                .join(OrderRecord, OrderRecord.order_id == OrderLine.order_id)
                .filter(
                    OrderRecord.status == "completed",
                    OrderLine.product_id.in_(product_ids),
                )
                .group_by(OrderLine.product_id)
                .all()
            )
        }

    return render_template(
        "admin/products.html",
        admin=g.admin_user,
        csrf_token=get_csrf_token(),
        products=products,
        product_sales=product_sales,
        search=search,
        status=status,
        total_products=Product.query.count(),
        active_products=Product.query.filter_by(is_active=True).count(),
    )


@admin_bp.get("/admin/customers")
@admin_required
def admin_customers():
    search = request.args.get("q", "").strip()[:100]
    status = request.args.get("status", "all")
    page = max(request.args.get("page", 1, type=int), 1)

    customers_query = User.query.filter_by(role="customer")
    if search:
        search_pattern = f"%{search}%"
        customers_query = customers_query.filter(
            or_(
                User.full_name.ilike(search_pattern),
                User.email.ilike(search_pattern),
            )
        )
    if status == "active":
        customers_query = customers_query.filter(User.is_active.is_(True))
    elif status == "inactive":
        customers_query = customers_query.filter(User.is_active.is_(False))
    else:
        status = "all"

    customers = customers_query.order_by(
        User.created_at.desc(),
        User.user_id.desc(),
    ).paginate(page=page, per_page=20, error_out=False)

    return render_template(
        "admin/customers.html",
        admin=g.admin_user,
        csrf_token=get_csrf_token(),
        customers=customers,
        search=search,
        status=status,
        total_customers=User.query.filter_by(role="customer").count(),
        active_customers=User.query.filter_by(
            role="customer",
            is_active=True,
        ).count(),
    )


@admin_bp.get("/admin/categories")
@admin_required
def admin_categories():
    categories = Category.query.order_by(
        Category.category_name,
        Category.category_id,
    ).all()
    categories = sorted(
        categories,
        key=lambda category: (
            get_category_path(category).casefold(),
            category.category_id,
        ),
    )
    category_paths = {
        category.category_id: get_category_path(category)
        for category in categories
    }
    return render_template(
        "admin/categories.html",
        admin=g.admin_user,
        csrf_token=get_csrf_token(),
        categories=categories,
        category_paths=category_paths,
    )


@admin_bp.post("/admin/categories")
@admin_required
def admin_create_category():
    name = request.form.get("category_name", "").strip()
    raw_parent_id = request.form.get("parent_id", "").strip()
    if not name or len(name) > 100:
        flash("Tên danh mục phải có từ 1 đến 100 ký tự.", "error")
        return redirect(url_for("admin.admin_categories"))

    parent_id = None
    if raw_parent_id:
        try:
            parent_id = int(raw_parent_id)
        except ValueError:
            flash("Danh mục cha không hợp lệ.", "error")
            return redirect(url_for("admin.admin_categories"))
        parent = Category.query.filter_by(
            category_id=parent_id,
            is_active=True,
        ).first()
        if parent is None:
            flash("Danh mục cha không tồn tại hoặc đã bị tắt.", "error")
            return redirect(url_for("admin.admin_categories"))

    duplicate = Category.query.filter_by(
        category_name=name,
        parent_id=parent_id,
    ).first()
    if duplicate is not None:
        flash("Danh mục này đã tồn tại ở cùng cấp.", "error")
        return redirect(url_for("admin.admin_categories"))

    db.session.add(Category(category_name=name, parent_id=parent_id))
    db.session.commit()
    flash(f"Đã thêm danh mục {name}.", "success")
    return redirect(url_for("admin.admin_categories"))


@admin_bp.post("/admin/sellers")
@admin_required
def admin_create_seller():
    try:
        seller, store = create_seller_account(
            request.form.get("email", ""),
            request.form.get("full_name", ""),
            request.form.get("store_name", ""),
            request.form.get("password", ""),
        )
    except ValueError as error:
        flash(str(error), "error")
    else:
        flash(
            f"Đã tạo người bán {seller.email} và cửa hàng {store.name}.",
            "success",
        )
    return redirect(url_for("admin.admin_dashboard"))


@admin_bp.post("/admin/customers/<int:user_id>/toggle-status")
@admin_required
def admin_toggle_customer_status(user_id):
    customer = User.query.filter_by(
        user_id=user_id,
        role="customer",
    ).first_or_404()
    customer.is_active = not customer.is_active
    db.session.commit()
    flash(
        f"Tài khoản {customer.email} đã được "
        f"{'mở khóa' if customer.is_active else 'khóa'}.",
        "success",
    )
    return redirect(
        url_for(
            "admin.admin_customers",
            q=request.form.get("q", ""),
            status=request.form.get("status", "all"),
            page=request.form.get("page", "1"),
        )
    )


@admin_bp.errorhandler(403)
def admin_forbidden(_error):
    return render_template(
        "admin/error.html",
        status=403,
        message="Bạn không có quyền truy cập trang quản trị.",
    ), 403
