import { formatPrice } from './formatPrice'

const placeholderImage = 'https://placehold.co/120x120?text=NOVIQ'

export default function CartPage({
  cart,
  total,
  onBack,
  onChangeQuantity,
  onRemove,
  onCheckout,
}) {
  return (
    <section className="container cart-page">
      <button className="product-detail-back" type="button" onClick={onBack}>
        ← Tiếp tục mua sắm
      </button>

      <div className="cart-page-heading">
        <div>
          <span className="section-kicker">NOVIQ CHECKOUT</span>
          <h1>Giỏ hàng của bạn</h1>
          <p>{cart.reduce((count, item) => count + item.quantity, 0)} sản phẩm</p>
        </div>
      </div>

      {cart.length === 0 ? (
        <div className="cart-page-empty">
          <span aria-hidden="true">🛒</span>
          <h2>Giỏ hàng đang trống</h2>
          <p>Hãy khám phá sản phẩm và thêm món hàng bạn yêu thích.</p>
          <button className="primary-btn" type="button" onClick={onBack}>
            Khám phá sản phẩm
          </button>
        </div>
      ) : (
        <div className="cart-page-layout">
          <div className="cart-page-items">
            {cart.map(({ product, quantity }) => (
              <article className="cart-page-item" key={product.id}>
                <img
                  src={product.image || product.image_url || placeholderImage}
                  alt={product.name}
                  onError={(event) => {
                    event.currentTarget.src = placeholderImage
                  }}
                />
                <div className="cart-page-item-info">
                  <span>{product.category || 'Sản phẩm'}</span>
                  <h2>{product.name}</h2>
                  <strong>{formatPrice(product.price)}</strong>
                  <div className="cart-page-item-actions">
                    <div className="cart-quantity-control" aria-label={`Số lượng ${product.name}`}>
                      <button
                        type="button"
                        aria-label={`Giảm số lượng ${product.name}`}
                        disabled={quantity <= 1}
                        onClick={() => onChangeQuantity(product.id, -1)}
                      >
                        −
                      </button>
                      <span>{quantity}</span>
                      <button
                        type="button"
                        aria-label={`Tăng số lượng ${product.name}`}
                        disabled={quantity >= product.stock}
                        onClick={() => onChangeQuantity(product.id, 1)}
                      >
                        +
                      </button>
                    </div>
                    <button
                      className="cart-item-remove"
                      type="button"
                      onClick={() => onRemove(product.id)}
                    >
                      Xóa
                    </button>
                  </div>
                  {quantity >= product.stock && (
                    <small className="cart-stock-note">Đã đạt số lượng tồn kho hiện có.</small>
                  )}
                </div>
                <strong className="cart-page-line-total">
                  {formatPrice(product.price * quantity)}
                </strong>
              </article>
            ))}
          </div>

          <aside className="cart-page-summary">
            <h2>Tóm tắt đơn hàng</h2>
            <div><span>Tạm tính</span><strong>{formatPrice(total)}</strong></div>
            <div><span>Phí vận chuyển</span><span className="free-shipping">Xác nhận sau</span></div>
            <div className="cart-page-total"><span>Tổng cộng</span><strong>{formatPrice(total)}</strong></div>
            <button className="checkout-btn" type="button" onClick={onCheckout}>
              Tiến hành đặt hàng <span>→</span>
            </button>
            <p className="checkout-note">Thanh toán khi nhận hàng (COD).</p>
          </aside>
        </div>
      )}
    </section>
  )
}
