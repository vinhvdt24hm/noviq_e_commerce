import { useState } from 'react'

export default function CheckoutDialog({ customer, onClose, onSubmit }) {
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    const formData = new FormData(event.currentTarget)
    try {
      await onSubmit(Object.fromEntries(formData.entries()))
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
      <section className="customer-dialog" role="dialog" aria-modal="true" aria-labelledby="checkout-dialog-title">
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Đóng">×</button>
        <span className="section-kicker">NOVIQ CHECKOUT</span>
        <h2 id="checkout-dialog-title">Thông tin giao hàng</h2>
        <p>Đang đặt hàng với tài khoản {customer?.email}.</p>
        <form className="customer-dialog-form" onSubmit={submit}>
          <label>Người nhận
            <input name="recipient_name" defaultValue={customer?.full_name || ''} autoComplete="name" required maxLength="255" />
          </label>
          <label>Số điện thoại
            <input name="phone_number" type="tel" autoComplete="tel" required maxLength="20" />
          </label>
          <label>Địa chỉ giao hàng
            <textarea name="shipping_address" autoComplete="street-address" required maxLength="500" rows="3" />
          </label>
          {error && <p className="dialog-error" role="alert">{error}</p>}
          <button className="checkout-btn" type="submit" disabled={submitting}>
            {submitting ? 'Đang tạo đơn...' : 'Đặt hàng (COD)'}
          </button>
        </form>
      </section>
    </div>
  )
}
