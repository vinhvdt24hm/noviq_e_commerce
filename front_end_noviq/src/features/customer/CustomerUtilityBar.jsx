import {
  Handshake,
  Headphones,
  LogIn,
  LogOut,
  PackageCheck,
  Smartphone,
  Store,
  UserRound,
} from 'lucide-react'

export default function CustomerUtilityBar({
  customer,
  onOrdersClick,
  onLoginClick,
  onLogout,
}) {
  return (
    <nav className="customer-utility-bar" aria-label="Liên kết nhanh">
      <div className="container customer-utility-bar__inner">
        <div className="customer-utility-bar__group customer-utility-bar__business-links">
          <a className="customer-utility-bar__link is-highlighted" href="/seller">
            <Store size={14} aria-hidden="true" />
            <span>Quản lý cửa hàng</span>
          </a>
          <a className="customer-utility-bar__link" href="#footer">
            <Handshake size={14} aria-hidden="true" />
            <span>Trở thành đối tác NOVIQ</span>
          </a>
          <a className="customer-utility-bar__link" href="#footer">
            <Smartphone size={14} aria-hidden="true" />
            <span>Tải ứng dụng</span>
          </a>
        </div>

        <div className="customer-utility-bar__group customer-utility-bar__account-links">
          <a className="customer-utility-bar__link" href="#support">
            <Headphones size={14} aria-hidden="true" />
            <span>Hỗ trợ</span>
          </a>
          <button
            className="customer-utility-bar__button"
            type="button"
            onClick={onOrdersClick}
          >
            <PackageCheck size={14} aria-hidden="true" />
            <span>Theo dõi đơn hàng</span>
          </button>
          {customer ? (
            <>
              <span
                className="customer-utility-bar__identity"
                title={customer.full_name}
              >
                <UserRound size={14} aria-hidden="true" />
                <span>{customer.full_name}</span>
              </span>
              <button
                className="customer-utility-bar__button"
                type="button"
                onClick={onLogout}
              >
                <LogOut size={14} aria-hidden="true" />
                <span>Đăng xuất</span>
              </button>
            </>
          ) : (
            <button
              className="customer-utility-bar__button is-account"
              type="button"
              onClick={onLoginClick}
            >
              <LogIn size={14} aria-hidden="true" />
              <span>Đăng nhập / Đăng ký</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}
