import {
  Bell,
  ChevronRight,
  LayoutDashboard,
  Menu,
  Package,
  Settings,
  ShoppingBag,
  Warehouse,
  X,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { id: "dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { id: "products", label: "Quản lý sản phẩm", icon: Package },
  { id: "inventory", label: "Quản lý kho", icon: Warehouse },
  { id: "orders", label: "Đơn hàng", icon: ShoppingBag },
];

export default function SellerLayout({
  page,
  title,
  alertCount,
  seller,
  onLogout,
  onNavigate,
  children,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  function navigate(id) {
    onNavigate(id);
    setMobileOpen(false);
  }

  return (
    <div className="seller-app">
      {mobileOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">N</div>
          <div>
            <h2>NOVIQ</h2>
            <span>QUẢN LÝ CỬA HÀNG</span>
          </div>
          <button
            className="mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Đóng menu"
          >
            <X />
          </button>
        </div>

        <div className="shop-card">
          <div className="shop-avatar">N</div>
          <div>
            <strong>{seller?.full_name || "NOVIQ Store"}</strong>
            <small>Gian hàng của bạn</small>
          </div>
          <span className="online-dot" />
        </div>

        <p className="nav-caption">MENU CHÍNH</p>
        <nav className="side-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={
                  page === item.id ||
                  (page === "form" && item.id === "products")
                    ? "active"
                    : ""
                }
                onClick={() => navigate(item.id)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
                {item.id === "inventory" && alertCount > 0 && (
                  <b className="nav-count">{alertCount}</b>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">✦</div>
            <strong>Cần hỗ trợ?</strong>
            <p>Liên hệ đội ngũ NOVIQ khi bạn cần trợ giúp.</p>
            <button onClick={() => alert("Khu vực hỗ trợ sẽ được kết nối sau.")}>
              Trung tâm hỗ trợ <ChevronRight size={15} />
            </button>
          </div>
          <a className="setting-link" href="/">
            <ShoppingBag size={18} /> Xem cửa hàng
          </a>
          <button
            className="setting-link"
            onClick={() => alert("Cài đặt sẽ được phát triển sau.")}
          >
            <Settings size={18} /> Cài đặt
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu"
              onClick={() => setMobileOpen(true)}
              aria-label="Mở menu"
            >
              <Menu />
            </button>
            <div>
              <span className="breadcrumb">NOVIQ / Quản lý cửa hàng</span>
              <h1>{title}</h1>
            </div>
          </div>
          <div className="top-actions">
            <button className="icon-button" title="Thông báo">
              <Bell size={19} />
              <i />
            </button>
            <div className="user-profile">
              <div className="user-avatar">N</div>
              <div>
                <strong>{seller?.full_name || seller?.email || "Người bán"}</strong>
                <small>Người bán</small>
              </div>
            </div>
            <button className="seller-logout" type="button" onClick={onLogout}>
              Đăng xuất
            </button>
          </div>
        </header>

        <section className="page-content">{children}</section>

        <footer className="footer">
          © 2026 NOVIQ. Quản lý cửa hàng.
          <span>
            Made for sellers <b>♥</b>
          </span>
        </footer>
      </main>
    </div>
  );
}
