import { formatPrice } from './formatPrice'

const statusLabels = {
  pending: 'Chờ xác nhận',
  processing: 'Đang xử lý',
  shipped: 'Đang giao',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}

export default function CustomerOrdersDialog({ orders, error, onClose }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="customer-dialog orders-dialog" role="dialog" aria-modal="true" aria-labelledby="orders-dialog-title">
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Đóng">×</button>
        <span className="section-kicker">TÀI KHOẢN NOVIQ</span>
        <h2 id="orders-dialog-title">Đơn hàng của bạn</h2>
        {error ? <p className="dialog-error" role="alert">{error}</p> : orders.length === 0 ? (
          <p>Bạn chưa có đơn hàng nào.</p>
        ) : (
          <div className="customer-order-list">
            {orders.map((order) => (
              <article className="customer-order" key={order.order_id}>
                <div><b>{order.id}</b><small>{order.date ? new Date(order.date).toLocaleString('vi-VN') : ''}</small></div>
                <span>{statusLabels[order.status] || order.status}</span>
                <strong>{formatPrice(order.total)}</strong>
                <ul>{order.items.map((item, index) => <li key={`${order.order_id}-${item.product_id || index}`}>{item.name} × {item.quantity}</li>)}</ul>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
