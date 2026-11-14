import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPin,
  Package,
  RefreshCw,
  ShoppingBag,
  Truck,
  X,
} from 'lucide-react'
import { fetchCustomerOrders } from '../../api/commerce'
import { formatPrice } from '../../utils/formatPrice'
import './styles/customer-orders.css'

const orderStatuses = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ xác nhận' },
  { value: 'processing', label: 'Đang xử lý' },
  { value: 'shipped', label: 'Đang giao' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Đã hủy' },
]

const statusDetails = {
  pending: { label: 'Chờ xác nhận', className: 'pending', icon: Clock3 },
  processing: { label: 'Đang xử lý', className: 'processing', icon: Package },
  shipped: { label: 'Đang giao', className: 'shipped', icon: Truck },
  completed: { label: 'Hoàn thành', className: 'completed', icon: CheckCircle2 },
  cancelled: { label: 'Đã hủy', className: 'cancelled', icon: X },
}

const progressSteps = [
  { status: 'pending', label: 'Đã đặt hàng', icon: ShoppingBag },
  { status: 'processing', label: 'Đang xử lý', icon: Package },
  { status: 'shipped', label: 'Đang giao', icon: Truck },
  { status: 'completed', label: 'Đã giao', icon: CheckCircle2 },
]

function formatOrderDate(value) {
  if (!value) return 'Đang cập nhật'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Đang cập nhật'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function OrderProgress({ status }) {
  if (status === 'cancelled') {
    return (
      <div className="order-cancelled-note">
        <X size={17} aria-hidden="true" />
        <span>Đơn hàng đã được hủy</span>
      </div>
    )
  }

  const activeStep = progressSteps.findIndex((step) => step.status === status)

  return (
    <ol className="order-progress" aria-label="Tiến trình đơn hàng">
      {progressSteps.map((step, index) => {
        const StepIcon = step.icon
        const isComplete = index < activeStep
        const isActive = index === activeStep

        return (
          <li
            className={`order-progress-step${isComplete ? ' is-complete' : ''}${isActive ? ' is-active' : ''}`}
            key={step.status}
          >
            <span className="order-progress-icon">
              {isComplete ? <Check size={15} aria-hidden="true" /> : <StepIcon size={15} aria-hidden="true" />}
            </span>
            <span>{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}

function OrderCard({ order }) {
  const status = statusDetails[order.status] || {
    label: order.status || 'Chưa xác định',
    className: 'pending',
    icon: Clock3,
  }
  const StatusIcon = status.icon

  return (
    <article className="tracked-order-card">
      <header className="tracked-order-header">
        <div className="tracked-order-number">
          <span className="tracked-order-icon"><ShoppingBag size={18} aria-hidden="true" /></span>
          <div>
            <span className="tracked-order-label">Mã đơn hàng</span>
            <strong>{order.id}</strong>
            <small>{order.store?.name || 'Cửa hàng'}</small>
          </div>
        </div>
        <span className={`order-status-badge ${status.className}`}>
          <StatusIcon size={15} aria-hidden="true" />
          {status.label}
        </span>
      </header>

      <div className="tracked-order-meta">
        <span><CalendarDays size={15} aria-hidden="true" /> {formatOrderDate(order.date)}</span>
        <span><MapPin size={15} aria-hidden="true" /> {order.address}</span>
      </div>

      <OrderProgress status={order.status} />

      <div className="tracked-order-items">
        {order.items.map((item, index) => (
          <div className="tracked-order-item" key={`${order.order_id}-${item.product_id || index}`}>
            {item.image_url ? (
              <img
                src={item.image_url}
                alt=""
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.hidden = true
                }}
              />
            ) : (
              <span className="tracked-order-item-placeholder"><Package size={20} aria-hidden="true" /></span>
            )}
            <div className="tracked-order-item-info">
              <strong>{item.name}</strong>
              <span>Số lượng: {item.quantity}</span>
            </div>
            <strong className="tracked-order-item-price">{formatPrice(item.unit_price * item.quantity)}</strong>
          </div>
        ))}
      </div>

      <footer className="tracked-order-footer">
        <span>Thanh toán khi nhận hàng (COD)</span>
        <div>
          <span>Tổng cộng</span>
          <strong>{formatPrice(order.total)}</strong>
        </div>
      </footer>
    </article>
  )
}

export default function CustomerOrdersPage({ onBack }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    fetchCustomerOrders()
      .then((result) => {
        if (active) setOrders(result)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [reloadKey])

  const visibleOrders = useMemo(
    () => selectedStatus === 'all'
      ? orders
      : orders.filter((order) => order.status === selectedStatus),
    [orders, selectedStatus],
  )
  const inProgressCount = orders.filter(
    (order) => ['pending', 'processing', 'shipped'].includes(order.status),
  ).length
  const completedCount = orders.filter((order) => order.status === 'completed').length

  function retryLoadingOrders() {
    setError('')
    setLoading(true)
    setReloadKey((key) => key + 1)
  }

  return (
    <section className="container customer-orders-page">
      <button className="orders-back-button" type="button" onClick={onBack}>
        <ArrowLeft size={17} aria-hidden="true" />
        Tiếp tục mua sắm
      </button>

      <header className="orders-hero">
        <div className="orders-hero-copy">
          <span className="section-kicker">TÀI KHOẢN NOVIQ</span>
          <h1>Theo dõi đơn hàng</h1>
          <p>Cập nhật trạng thái và xem lại các đơn hàng bạn đã đặt tại NOVIQ.</p>
        </div>
        <div className="orders-hero-art" aria-hidden="true">
          <span className="orders-hero-orbit orders-hero-orbit-one" />
          <span className="orders-hero-orbit orders-hero-orbit-two" />
          <span className="orders-hero-package"><Package size={42} strokeWidth={1.7} /></span>
          <span className="orders-hero-check"><Check size={16} /></span>
        </div>
      </header>

      <div className="orders-summary" aria-label="Tổng quan đơn hàng">
        <article>
          <span className="orders-summary-icon all"><ShoppingBag size={19} aria-hidden="true" /></span>
          <div><strong>{orders.length}</strong><span>Tổng đơn hàng</span></div>
        </article>
        <article>
          <span className="orders-summary-icon active"><Truck size={19} aria-hidden="true" /></span>
          <div><strong>{inProgressCount}</strong><span>Đang xử lý</span></div>
        </article>
        <article>
          <span className="orders-summary-icon done"><CheckCircle2 size={19} aria-hidden="true" /></span>
          <div><strong>{completedCount}</strong><span>Đã hoàn thành</span></div>
        </article>
      </div>

      <div className="orders-list-heading">
        <div>
          <span className="section-kicker">LỊCH SỬ MUA HÀNG</span>
          <h2>Đơn hàng của bạn</h2>
        </div>
        <button
          className="orders-refresh-button"
          type="button"
          onClick={retryLoadingOrders}
          disabled={loading}
        >
          <RefreshCw size={15} aria-hidden="true" />
          Làm mới
        </button>
      </div>

      <nav className="orders-status-filters" aria-label="Lọc đơn hàng">
        {orderStatuses.map((status) => (
          <button
            className={selectedStatus === status.value ? 'active' : ''}
            key={status.value}
            type="button"
            aria-pressed={selectedStatus === status.value}
            onClick={() => setSelectedStatus(status.value)}
          >
            {status.label}
            {status.value === 'all' && <span>{orders.length}</span>}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="orders-loading-list" aria-label="Đang tải đơn hàng">
          {[1, 2].map((item) => <div className="orders-loading-card" key={item} />)}
        </div>
      ) : error ? (
        <div className="orders-state-card orders-error-state" role="alert">
          <span className="orders-state-icon"><RefreshCw size={23} aria-hidden="true" /></span>
          <h3>Chưa thể tải đơn hàng</h3>
          <p>{error}</p>
          <button className="orders-primary-button" type="button" onClick={retryLoadingOrders}>
            Thử lại <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="orders-state-card">
          <span className="orders-state-icon"><ShoppingBag size={26} aria-hidden="true" /></span>
          <h3>Bạn chưa có đơn hàng nào</h3>
          <p>Đơn hàng đã đặt sẽ xuất hiện tại đây để bạn tiện theo dõi.</p>
          <button className="orders-primary-button" type="button" onClick={onBack}>
            Khám phá sản phẩm <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      ) : visibleOrders.length === 0 ? (
        <div className="orders-state-card orders-filter-empty">
          <span className="orders-state-icon"><Package size={26} aria-hidden="true" /></span>
          <h3>Không có đơn hàng ở trạng thái này</h3>
          <p>Hãy chọn trạng thái khác để xem các đơn hàng của bạn.</p>
        </div>
      ) : (
        <div className="tracked-order-list">
          {visibleOrders.map((order) => <OrderCard key={order.order_id} order={order} />)}
        </div>
      )}
    </section>
  )
}
