import { useState } from "react";
import "./SellerAuth.css";

export default function SellerLogin({ onLogin, error, loading }) {
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const formData = new FormData(event.currentTarget);
      await onLogin(Object.fromEntries(formData.entries()));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="seller-auth-page">
      <form className="seller-auth-card" onSubmit={submit}>
        <a className="seller-auth-brand" href="/">NOVIQ <span>QUẢN LÝ CỬA HÀNG</span></a>
        <h1>Đăng nhập quản lý cửa hàng</h1>
        <p>Dùng tài khoản người bán được cấp cho cửa hàng của bạn để tiếp tục.</p>
        {loading ? <p>Đang kiểm tra phiên đăng nhập...</p> : (
          <>
            <label>Email
              <input name="email" type="email" autoComplete="username" required />
            </label>
            <label>Mật khẩu
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            {error && <p className="seller-auth-error" role="alert">{error}</p>}
            <button type="submit" disabled={submitting}>
              {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </>
        )}
        <a className="seller-auth-back" href="/">Quay lại cửa hàng</a>
      </form>
    </main>
  );
}
