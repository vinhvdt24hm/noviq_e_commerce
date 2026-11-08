import {
  Boxes,
  CircleAlert,
  ChevronRight,
  Package,
  Plus,
  ShoppingBag,
  Warehouse,
} from "lucide-react";
import { formatMoney } from "./sellerData";

const today = new Intl.DateTimeFormat("vi-VN", { dateStyle: "long" }).format(
  new Date(),
);

export default function Dashboard({
  products,
  orders,
  lowStock,
  outStock,
  seller,
  onNavigate,
}) {
  const totalStock = products.reduce(
    (sum, product) => sum + Number(product.stock),
    0,
  );
  const cards = [
    {
      label: "Tổng sản phẩm",
      value: products.length,
      icon: Package,
      note: "Sản phẩm trong gian hàng",
    },
    {
      label: "Tổng tồn kho",
      value: totalStock,
      icon: Boxes,
      note: "Đơn vị sản phẩm",
    },
    {
      label: "Đơn hàng",
      value: orders.length,
      icon: ShoppingBag,
      note: "Đơn hàng trong hệ thống",
    },
    {
      label: "Cảnh báo tồn kho",
      value: lowStock + outStock,
      icon: CircleAlert,
      note: `${outStock} sản phẩm đã hết hàng`,
    },
  ];

  return (
    <>
      <div className="welcome-banner">
        <div>
          <span className="eyebrow">SELLER OVERVIEW</span>
          <h2>
            Chào mừng trở lại, {seller?.full_name || "gian hàng của bạn"}! <span>✦</span>
          </h2>
          <p>Theo dõi và quản lý hoạt động kinh doanh của bạn tại đây.</p>
        </div>
        <div className="banner-decoration">N</div>
      </div>

      <div className="section-heading">
        <div>
          <h2>Tổng quan kinh doanh</h2>
          <p>Các chỉ số hoạt động của gian hàng</p>
        </div>
        <span className="date-chip">{today}</span>
      </div>

      <div className="stats-grid">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div className="stat-card" key={card.label}>
              <div className={`stat-icon stat-${index}`}>
                <Icon size={21} />
              </div>
              <span>{card.label}</span>
              <strong>{card.value.toLocaleString("vi-VN")}</strong>
              <small>{card.note}</small>
            </div>
          );
        })}
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Sản phẩm gần đây</h3>
              <p>Các sản phẩm trong gian hàng</p>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("products")}
            >
              Xem tất cả <ChevronRight size={15} />
            </button>
          </div>
          <div className="mini-product-list">
            {products.slice(0, 4).map((product) => (
              <div className="mini-product" key={product.id}>
                <img
                  src={product.image || "https://placehold.co/80x80?text=NOVIQ"}
                  alt={product.name}
                />
                <div className="mini-product-info">
                  <strong>{product.name}</strong>
                  <small>{product.category}</small>
                </div>
                <b>{formatMoney(product.price)}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="panel quick-panel">
          <div className="panel-heading">
            <div>
              <h3>Thao tác nhanh</h3>
              <p>Truy cập chức năng thường dùng</p>
            </div>
          </div>
          <button
            className="quick-action"
            onClick={() => onNavigate("products")}
          >
            <span>
              <Plus />
            </span>
            <div>
              <b>Thêm sản phẩm</b>
              <small>Đăng sản phẩm mới</small>
            </div>
            <ChevronRight />
          </button>
          <button
            className="quick-action"
            onClick={() => onNavigate("inventory")}
          >
            <span>
              <Warehouse />
            </span>
            <div>
              <b>Kiểm tra kho</b>
              <small>Theo dõi số lượng tồn</small>
            </div>
            <ChevronRight />
          </button>
          <button
            className="quick-action"
            onClick={() => onNavigate("orders")}
          >
            <span>
              <ShoppingBag />
            </span>
            <div>
              <b>Xem đơn hàng</b>
              <small>Quản lý đơn mua hàng</small>
            </div>
            <ChevronRight />
          </button>
        </div>
      </div>
    </>
  );
}
