import { useEffect, useMemo, useState } from 'react'
import {
  createOrder,
  fetchCurrentUser,
  fetchCustomerOrders,
  fetchProducts,
  login,
  logout,
  registerCustomer,
} from '../../api/commerce'
import AccountDialog from './AccountDialog'
import CartPage from './CartPage'
import CheckoutDialog from './CheckoutDialog'
import CustomerOrdersDialog from './CustomerOrdersDialog'
import ProductDetailPage from './ProductDetailPage'
import SupportChatWidget from './SupportChatWidget'
import { formatPrice } from './formatPrice'
import './Customer.css';

const categories = [
  { name: 'Thời trang', icon: '👕' },
  { name: 'Điện tử', icon: '🎧' },
  { name: 'Gia dụng', icon: '🏠' },
  { name: 'Làm đẹp', icon: '🧴' },
  { name: 'Đời sống', icon: '🎒' },
  { name: 'Thể thao', icon: '⚽' },
]
const categoryIcons = Object.fromEntries(categories.map((item) => [item.name, item.icon]))

function getProductIdFromPath() {
  const match = window.location.pathname.match(/^\/products\/(\d+)\/?$/)
  return match ? match[1] : null
}

function isCartPath() {
  return window.location.pathname.replace(/\/+$/, '') === '/cart'
}

const slides = [
  {
    eyebrow: 'NOVIQ STORE',
    title: <>Mua sắm thông minh.<br /><em>Sống trọn tiện nghi.</em></>,
    description: 'Khám phá sản phẩm và đặt hàng thuận tiện trên NOVIQ.',
    action: 'Khám phá sản phẩm →',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=85',
    alt: 'Tai nghe công nghệ',
  },
  {
    eyebrow: 'SẢN PHẨM ĐA DẠNG',
    title: <>Lựa chọn yêu thích.<br /><em>Đặt hàng dễ dàng.</em></>,
    description: 'Tìm kiếm theo danh mục và theo dõi đơn hàng trong tài khoản.',
    action: 'Mua sắm ngay →',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=85',
    alt: 'Đồng hồ phong cách',
  },
  {
    eyebrow: 'THANH TOÁN KHI NHẬN HÀNG',
    title: <>Chọn sản phẩm.<br /><em>Nhận hàng tại nhà.</em></>,
    description: 'Hiện hỗ trợ đặt hàng COD; cổng thanh toán trực tuyến chưa được kết nối.',
    action: 'Xem sản phẩm →',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=85',
    alt: 'Giày thể thao nổi bật',
  },
]

function CustomerApp() {
  const [catalog, setCatalog] = useState([])
  const [selectedProductId, setSelectedProductId] = useState(getProductIdFromPath)
  const [cartPageOpen, setCartPageOpen] = useState(isCartPath)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [customer, setCustomer] = useState(null)
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('featured')
  const [slideIndex, setSlideIndex] = useState(0)
  const [cart, setCart] = useState([])
  const [toast, setToast] = useState('')
  const [accountOpen, setAccountOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutPending, setCheckoutPending] = useState(false)
  const [ordersOpen, setOrdersOpen] = useState(false)
  const [customerOrders, setCustomerOrders] = useState([])
  const [ordersError, setOrdersError] = useState('')

  useEffect(() => {
    function syncProductRoute() {
      setSelectedProductId(getProductIdFromPath())
      setCartPageOpen(isCartPath())
    }

    window.addEventListener('popstate', syncProductRoute)
    return () => window.removeEventListener('popstate', syncProductRoute)
  }, [])

  useEffect(() => {
    let active = true
    fetchProducts()
      .then((result) => {
        if (active) setCatalog(result)
      })
      .catch((error) => {
        if (active) setCatalogError(error.message)
      })
      .finally(() => {
        if (active) setCatalogLoading(false)
      })
    fetchCurrentUser()
      .then((result) => {
        if (active) setCustomer(result)
      })
      .catch((error) => {
        if (active) setToast(error.message)
      })
    return () => {
      active = false
    }
  }, [])

  const products = useMemo(() => catalog.map((product) => ({
    ...product,
    image: product.image_url,
    emoji: '🛍️',
    color: 'linear-gradient(145deg,#f1eefa,#ddd8eb)',
    badge: product.stock === 0 ? 'Hết hàng' : 'Sản phẩm',
  })), [catalog])
  const catalogCategories = useMemo(
    () => [...new Set(products.map((product) => product.category))]
      .filter(Boolean)
      .map((name) => ({ name, icon: categoryIcons[name] || '✦' })),
    [products],
  )

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi')
    const result = products.filter((product) => {
      const matchesCategory = category === 'all' || product.category === category
      const matchesSearch = !query || `${product.name} ${product.category}`.toLocaleLowerCase('vi').includes(query)
      return matchesCategory && matchesSearch
    })

    if (sort === 'priceAsc') result.sort((a, b) => a.price - b.price)
    if (sort === 'priceDesc') result.sort((a, b) => b.price - a.price)
    return result
  }, [category, search, sort, products])

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0)
  const cartTotal = cart.reduce((total, item) => total + item.product.price * item.quantity, 0)
  const currentSlide = slides[slideIndex]

  function openProduct(productId) {
    window.history.pushState({}, '', `/products/${productId}`)
    setSelectedProductId(String(productId))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goHome() {
    window.history.pushState({}, '', '/')
    setSelectedProductId(null)
    setCartPageOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openCartPage() {
    window.history.pushState({}, '', '/cart')
    setSelectedProductId(null)
    setCartPageOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function chooseCategory(nextCategory) {
    const wasOnProductPage = Boolean(selectedProductId)
    if (wasOnProductPage) goHome()
    setCategory(nextCategory)
    setSearch('')
    window.setTimeout(
      () => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }),
      0,
    )
  }

  function addToCart(product) {
    const alreadyInCart =
      cart.find((item) => item.product.id === product.id)?.quantity || 0
    if (product.stock <= alreadyInCart) {
      setToast('Sản phẩm hiện không đủ tồn kho.')
      window.setTimeout(() => setToast(''), 2400)
      return
    }
    setCart((items) => {
      const existingItem = items.find((item) => item.product.id === product.id)
      if (existingItem) {
        return items.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        )
      }
      return [...items, { product, quantity: 1 }]
    })
    setToast(`Đã thêm "${product.name}" vào giỏ hàng`)
    window.setTimeout(() => setToast(''), 2400)
  }

  function changeCartQuantity(productId, amount) {
    const item = cart.find(({ product }) => product.id === productId)
    if (!item) return
    if (amount > 0 && item.quantity >= item.product.stock) {
      setToast('Số lượng đã đạt tồn kho hiện có.')
      window.setTimeout(() => setToast(''), 2400)
      return
    }

    setCart((items) => items.map((current) => (
      current.product.id === productId
        ? { ...current, quantity: Math.max(1, current.quantity + amount) }
        : current
    )))
  }

  function removeFromCart(productId) {
    setCart((items) => items.filter((item) => item.product.id !== productId))
  }

  function beginCheckout() {
    if (!customer) {
      setCheckoutPending(true)
      setAccountOpen(true)
      return
    }
    setCheckoutOpen(true)
  }

  function handleSearch(event) {
    event.preventDefault()
    if (selectedProductId) goHome()
    setCategory('all')
    window.setTimeout(
      () => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }),
      0,
    )
  }

  function handleNewsletter(event) {
    event.preventDefault()
    setToast('Chức năng đăng ký nhận tin chưa được kết nối.')
    event.currentTarget.reset()
    window.setTimeout(() => setToast(''), 2400)
  }

  async function handleAccountSubmit(mode, details) {
    const loggedInCustomer =
      mode === 'register' ? await registerCustomer(details) : await login(details)
    setCustomer(loggedInCustomer)
    setAccountOpen(false)
    setToast(`Xin chào ${loggedInCustomer.full_name}`)
    window.setTimeout(() => setToast(''), 2400)
    if (checkoutPending) {
      setCheckoutPending(false)
      setCheckoutOpen(true)
    }
  }

  async function handleLogout() {
    try {
      await logout()
      setCustomer(null)
      setToast('Bạn đã đăng xuất.')
      window.setTimeout(() => setToast(''), 2400)
    } catch (error) {
      setToast(error.message)
      window.setTimeout(() => setToast(''), 4000)
    }
  }

  async function handleOrderSubmit(details) {
    const order = await createOrder({
      ...details,
      items: cart.map(({ product, quantity }) => ({
        product_id: product.id,
        quantity,
      })),
    })
    setCart([])
    setCheckoutOpen(false)
    setToast(`Đặt hàng thành công: ${order.id}`)
    window.setTimeout(() => setToast(''), 4000)
    try {
      setCatalog(await fetchProducts())
    } catch (error) {
      setToast(`Đơn đã được tạo, nhưng không thể tải lại tồn kho: ${error.message}`)
      window.setTimeout(() => setToast(''), 5000)
    }
  }

  async function showCustomerOrders() {
    if (!customer) {
      setAccountOpen(true)
      return
    }
    try {
      setOrdersError('')
      setCustomerOrders(await fetchCustomerOrders())
      setOrdersOpen(true)
    } catch (error) {
      setOrdersError(error.message)
      setOrdersOpen(true)
    }
  }

  return (
    <div className="customer-store">
      <div className="top-strip">
        <div className="container top-strip-inner">
          <div className="top-links">
            <a href="/seller">Quản lý cửa hàng</a><span>|</span>
            <a href="#footer">Trở thành đối tác NOVIQ</a><span>|</span>
            <a href="#footer">Tải ứng dụng</a>
          </div>
          <div className="top-links">
            <a href="#support">Hỗ trợ</a>
            <button type="button" onClick={showCustomerOrders}>Theo dõi đơn hàng</button>
            {customer ? (
              <>
                <span className="account-link">{customer.full_name}</span>
                <button type="button" onClick={handleLogout}>Đăng xuất</button>
              </>
            ) : (
              <button type="button" className="account-link" onClick={() => setAccountOpen(true)}>
                Đăng nhập / Đăng ký
              </button>
            )}
          </div>
        </div>
      </div>

      <header className="site-header">
        <div className="container header-main">
          <a className="brand" href="/" onClick={(event) => { event.preventDefault(); goHome() }} aria-label="NOVIQ - Trang chủ">
            <span className="brand-mark">N<span>✦</span></span>
            <span className="brand-name">NOV<span className="brand-q">I</span>Q
              <small>ONE PLATFORM. EVERY NEED.</small>
            </span>
          </a>
          <form className="search" onSubmit={handleSearch}>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm sản phẩm, thương hiệu và danh mục..."
              aria-label="Tìm kiếm sản phẩm"
            />
            <select aria-label="Danh mục tìm kiếm" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">Tất cả</option>
              {catalogCategories.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
            </select>
            <button type="submit" className="search-btn">⌕ <span>Tìm kiếm</span></button>
          </form>
          <button className="cart-button" type="button" onClick={openCartPage} aria-label={`Mở giỏ hàng, ${cartCount} sản phẩm`}>
            <span className="cart-icon">🛒</span><span className="cart-label">Giỏ hàng</span><b>{cartCount}</b>
          </button>
        </div>
        <div className="container popular-searches">
          <span>Xu hướng:</span>
          {['tai nghe', 'áo thun', 'bình giữ nhiệt', 'đèn bàn'].map((term) => (
            <button key={term} type="button" onClick={() => { setSearch(term); setCategory('all') }}>{term}</button>
          ))}
        </div>
      </header>

      <main id="top">
        {selectedProductId ? (
          <ProductDetailPage
            key={selectedProductId}
            productId={selectedProductId}
            customerName={customer?.full_name || ''}
            onBack={goHome}
            onAddToCart={addToCart}
          />
        ) : cartPageOpen ? (
          <CartPage
            cart={cart}
            total={cartTotal}
            onBack={goHome}
            onChangeQuantity={changeCartQuantity}
            onRemove={removeFromCart}
            onCheckout={beginCheckout}
          />
        ) : (
          <>
        <section className="container hero-layout">
          <aside className="category-panel">
            <h2>Danh mục</h2>
            <button className={`category-link ${category === 'all' ? 'active' : ''}`} type="button" onClick={() => chooseCategory('all')}><span>✦</span> Tất cả sản phẩm</button>
            {catalogCategories.map((item) => (
              <button className={`category-link ${category === item.name ? 'active' : ''}`} data-category={item.name} key={item.name} type="button" onClick={() => chooseCategory(item.name)}>
                <span>{item.icon}</span> {item.name}
              </button>
            ))}
            <div className="category-note"><strong>Mua sắm thông minh</strong><p>Khám phá hàng ngàn lựa chọn cho cuộc sống mỗi ngày.</p></div>
          </aside>

          <div className="hero-main">
            <div className="hero-banner mega-banner">
              <div className="mega-slides">
                <a href="#products" className="mega-slide active">
                  <div className="hero-copy">
                    <span className="eyebrow">{currentSlide.eyebrow}</span>
                    <h1>{currentSlide.title}</h1>
                    <p>{currentSlide.description}</p>
                    <span className="primary-btn">{currentSlide.action}</span>
                  </div>
                  <div className="mega-image">
                    <img src={currentSlide.image} alt={currentSlide.alt} />
                  </div>
                </a>
              </div>
              <button className="mega-arrow mega-prev" type="button" aria-label="Banner trước" onClick={() => setSlideIndex((slideIndex + slides.length - 1) % slides.length)}>‹</button>
              <button className="mega-arrow mega-next" type="button" aria-label="Banner tiếp theo" onClick={() => setSlideIndex((slideIndex + 1) % slides.length)}>›</button>
              <div className="mega-dots">
                {slides.map((slide, index) => (
                  <button key={slide.eyebrow} className={`mega-dot ${index === slideIndex ? 'active' : ''}`} type="button" aria-label={`Banner ${index + 1}`} onClick={() => setSlideIndex(index)} />
                ))}
              </div>
            </div>
            <div className="service-row">
              <div className="service-item"><span className="service-icon">🚚</span><div><b>Giao hàng tiện lợi</b><small>Theo dõi đơn dễ dàng</small></div></div>
              <div className="service-item"><span className="service-icon">🛡️</span><div><b>Mua sắm an tâm</b><small>Thông tin rõ ràng</small></div></div>
              <div className="service-item"><span className="service-icon">💳</span><div><b>Thanh toán khi nhận hàng</b><small>COD</small></div></div>
            </div>
          </div>
        </section>

        <section className="container quick-categories">
          <div className="section-heading">
            <div><span className="section-kicker">KHÁM PHÁ</span><h2>Mua sắm theo danh mục</h2></div>
            <button className="text-link" type="button" onClick={() => chooseCategory('all')}>Xem tất cả →</button>
          </div>
          <div className="quick-grid">
            {catalogCategories.map((item, index) => (
              <button className="quick-category" data-category={item.name} key={item.name} type="button" onClick={() => chooseCategory(item.name)}>
                <span className={`quick-icon ${['pink', 'blue', 'yellow', 'lilac', 'mint', 'peach'][index]}`}>{item.icon}</span>
                <b>{item.name}</b><small>Khám phá sản phẩm</small>
              </button>
            ))}
          </div>
        </section>

        <section className="container flash-section">
          <div className="flash-heading">
            <div className="flash-title"><span className="bolt">✦</span><div><span className="section-kicker">TỪ DANH MỤC SẢN PHẨM</span><h2>SẢN PHẨM NỔI BẬT</h2></div></div>
            <button className="text-link" type="button" onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}>Xem tất cả →</button>
          </div>
          <div className="deal-grid">
            {products.slice(0, 4).map((product) => (
              <article
                className="deal-card product-card-clickable"
                key={product.id}
                role="link"
                tabIndex={0}
                onClick={() => openProduct(product.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openProduct(product.id)
                  }
                }}
              >
                <div className="product-image" style={{ background: product.color }}>
                  {product.image ? <img src={product.image} alt={product.name} /> : <span className="image-emoji">{product.emoji}</span>}
                </div>
                <h3>{product.name}</h3>
                <div><span className="deal-price">{formatPrice(product.price)}</span></div>
                <div className="sold-text">Còn {product.stock} sản phẩm</div>
                <button className="add-cart deal-add-cart" type="button" disabled={product.stock === 0} onClick={(event) => { event.stopPropagation(); addToCart(product) }}>＋ Thêm vào giỏ</button>
              </article>
            ))}
          </div>
        </section>

        <section className="container products-section" id="products">
          <div className="products-heading">
            <div><span className="section-kicker">DÀNH RIÊNG CHO BẠN</span><h2>{search ? `Kết quả tìm kiếm: "${search}"` : category === 'all' ? 'Gợi ý hôm nay' : category}</h2><p className="muted">Những sản phẩm đáng khám phá trên NOVIQ.</p></div>
            <div className="product-controls">
              <select aria-label="Sắp xếp sản phẩm" value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="featured">Sắp xếp: Nổi bật</option><option value="priceAsc">Giá tăng dần</option><option value="priceDesc">Giá giảm dần</option>
              </select>
            </div>
          </div>
          <div className="filter-chips">
            <button className={`chip ${category === 'all' ? 'active' : ''}`} type="button" onClick={() => chooseCategory('all')}>Tất cả</button>
            {catalogCategories.slice(0, 5).map((item) => <button className={`chip ${category === item.name ? 'active' : ''}`} data-category={item.name} key={item.name} type="button" onClick={() => chooseCategory(item.name)}>{item.name}</button>)}
          </div>
          {catalogLoading ? (
            <div className="empty-state"><p>Đang tải sản phẩm...</p></div>
          ) : catalogError ? (
            <div className="empty-state"><h3>Không tải được sản phẩm</h3><p>{catalogError}</p></div>
          ) : filteredProducts.length > 0 ? (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <article
                  className="product-card product-card-clickable"
                  data-id={product.id}
                  key={product.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => openProduct(product.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openProduct(product.id)
                    }
                  }}
                >
                  <span className="product-badge">{product.badge}</span>
                  <div className="product-image" style={{ background: product.color }}>
                    {product.image ? <img src={product.image} alt={product.name} /> : <span className="image-emoji">{product.emoji}</span>}
                  </div>
                  <div className="product-info">
                    <h3>{product.name}</h3>
                    <div className="price-row"><span className="price">{formatPrice(product.price)}</span></div>
                    <div className="product-meta"><span>{product.stock > 0 ? `Còn ${product.stock} sản phẩm` : 'Tạm hết hàng'}</span></div>
                    <button className="add-cart" type="button" disabled={product.stock === 0} onClick={(event) => { event.stopPropagation(); addToCart(product) }}>＋ Thêm vào giỏ</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span>⌕</span><h3>Chưa tìm thấy sản phẩm</h3><p>Thử từ khóa khác hoặc chọn danh mục khác nhé.</p>
              <button className="primary-btn" type="button" onClick={() => { setSearch(''); chooseCategory('all') }}>Xem tất cả sản phẩm</button>
            </div>
          )}
        </section>

        <section className="container newsletter">
          <div className="newsletter-symbol">N<span>✦</span></div>
          <div><span className="section-kicker">NOVIQ NEWSLETTER</span><h2>Đừng bỏ lỡ những điều thú vị</h2><p>Đăng ký nhận thông tin ưu đãi và sản phẩm mới.</p></div>
          <form onSubmit={handleNewsletter}><input type="email" placeholder="Nhập email của bạn" aria-label="Email của bạn" required /><button type="submit">Đăng ký</button></form>
        </section>
          </>
        )}
      </main>

      <footer id="footer">
        <div className="container footer-grid">
          <div className="footer-brand"><a className="brand" href="/" onClick={(event) => { event.preventDefault(); goHome() }}><span className="brand-mark">N<span>✦</span></span><span className="brand-name">NOVIQ<small>ONE PLATFORM. EVERY NEED.</small></span></a><p>Một điểm đến cho mọi nhu cầu mua sắm. Khám phá, lựa chọn và tận hưởng trải nghiệm mua sắm tiện lợi.</p></div>
          <div><h3>Về NOVIQ</h3><a href="#footer">Giới thiệu</a><a href="#footer">Cơ hội nghề nghiệp</a><a href="#footer">Tin tức</a></div>
          <div><h3>Hỗ trợ khách hàng</h3><a href="#support">Trung tâm hỗ trợ</a><a href="#support">Hướng dẫn mua hàng</a><a href="#support">Chính sách đổi trả</a></div>
          <div id="support"><h3>Kết nối với chúng tôi</h3><p>Email: support@noviq.example</p><p>Hotline: 1900 0000</p><div className="socials"><span>f</span><span>◎</span><span>▶</span></div></div>
        </div>
        <div className="container footer-bottom"><span>© 2026 NOVIQ. Nền tảng thương mại điện tử đang phát triển.</span><span>Điều khoản · Chính sách bảo mật</span></div>
      </footer>

      {accountOpen && (
        <AccountDialog
          onClose={() => {
            setAccountOpen(false)
            setCheckoutPending(false)
          }}
          onSubmit={handleAccountSubmit}
        />
      )}
      {checkoutOpen && (
        <CheckoutDialog
          customer={customer}
          onClose={() => setCheckoutOpen(false)}
          onSubmit={handleOrderSubmit}
        />
      )}
      {ordersOpen && (
        <CustomerOrdersDialog
          orders={customerOrders}
          error={ordersError}
          onClose={() => setOrdersOpen(false)}
        />
      )}
      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">{toast}</div>
      <SupportChatWidget />
    </div>
  )
}

export default CustomerApp;
