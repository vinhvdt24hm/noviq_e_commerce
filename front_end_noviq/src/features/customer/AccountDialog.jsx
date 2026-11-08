import { useState } from 'react'

export default function AccountDialog({ onClose, onSubmit }) {
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    const formData = new FormData(event.currentTarget)
    const details = Object.fromEntries(formData.entries())
    try {
      await onSubmit(mode, details)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="customer-dialog" role="dialog" aria-modal="true" aria-labelledby="account-dialog-title">
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Đóng">×</button>
        <span className="section-kicker">TÀI KHOẢN NOVIQ</span>
        <h2 id="account-dialog-title">{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</h2>
        <p>{mode === 'login' ? 'Đăng nhập để theo dõi đơn hàng và đặt mua sản phẩm.' : 'Tạo tài khoản khách hàng để bắt đầu mua sắm.'}</p>
        <form className="customer-dialog-form" onSubmit={submit}>
          {mode === 'register' && (
            <label>Họ và tên
              <input name="full_name" autoComplete="name" required maxLength="255" />
            </label>
          )}
          <label>Email
            <input name="email" type="email" autoComplete="email" required maxLength="150" />
          </label>
          <label>Mật khẩu
            <input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength="8" />
          </label>
          {error && <p className="dialog-error" role="alert">{error}</p>}
          <button className="checkout-btn" type="submit" disabled={submitting}>
            {submitting ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
          </button>
        </form>
        <button className="dialog-switch" type="button" onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login')
          setError('')
        }}>
          {mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
        </button>
      </section>
    </div>
  )
}
