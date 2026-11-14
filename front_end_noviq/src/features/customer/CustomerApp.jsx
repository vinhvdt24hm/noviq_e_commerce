import { useEffect, useMemo, useState } from 'react'
import {
  createOrder,
  fetchCurrentUser,
  fetchProductCategories,
  fetchProductPage,
  login,
  logout,
  registerCustomer,
} from '../../api/commerce'
import AccountDialog from './AccountDialog'
import CartPage from '../cart/CartPage'
import CheckoutDialog from '../orders/CheckoutDialog'
import CustomerOrdersPage from '../orders/CustomerOrdersPage'
import CustomerMainHeader from './CustomerMainHeader'
import ProductPagination from '../products/ProductPagination'
import ProductDetailPage from '../products/ProductDetailPage'
import CustomerUtilityBar from './CustomerUtilityBar'
import HomeBenefits from './HomeBenefits'
import SupportChatWidget from './SupportChatWidget'
import { formatPrice } from '../../utils/formatPrice'
import './Customer.css';
import './styles/tokens.css'
import './styles/storefront.css'
import './styles/catalog.css'
import './styles/responsive.css'
import './styles/customer-utility-bar.css'
import './styles/customer-main-header.css'
import './styles/home-benefits.css'
import '../products/styles/product-detail.css'
import '../products/styles/product-reviews.css'

const categories = [
  { name: 'Thời trang', icon: '👕' },
  { name: 'Điện tử', icon: '🎧' },
  { name: 'Gia dụng', icon: '🏠' },
  { name: 'Làm đẹp', icon: '🧴' },
  { name: 'Đời sống', icon: '🎒' },
  { name: 'Thể thao', icon: '⚽' },
]
const categoryIcons = Object.fromEntries(categories.map((item) => [item.name, item.icon]))
const PRODUCTS_PER_PAGE = 12

function flattenCategoryTree(nodes, ancestors = []) {
  return nodes.flatMap((node) => {
    const path = [...ancestors, node.name]
    return [
      { id: node.id, name: node.name, path: path.join(' / ') },
      ...flattenCategoryTree(node.children || [], path),
    ]
  })
}

function mapCatalogProduct(product) {
  return {
    ...product,
    image: product.image_url,
    emoji: '🛍️',
    color: 'linear-gradient(145deg,#f1eefa,#ddd8eb)',
    badge: product.stock === 0 ? 'Hết hàng' : 'Còn hàng',
  }
}

function getProductIdFromPath() {
  const match = window.location.pathname.match(/^\/products\/(\d+)\/?$/)
  return match ? match[1] : null
}

function isCartPath() {
  return window.location.pathname.replace(/\/+$/, '') === '/cart'
}

function isOrdersPath() {
  return window.location.pathname.replace(/\/+$/, '') === '/orders'
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
  const [featuredCatalog, setFeaturedCatalog] = useState([])
  const [categoryTree, setCategoryTree] = useState([])
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: PRODUCTS_PER_PAGE,
    total_items: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false,
  })
  const [selectedProductId, setSelectedProductId] = useState(getProductIdFromPath)
  const [cartPageOpen, setCartPageOpen] = useState(isCartPath)
  const [ordersPageOpen, setOrdersPageOpen] = useState(isOrdersPath)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [featuredError, setFeaturedError] = useState('')
  const [customer, setCustomer] = useState(null)
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sort, setSort] = useState('featured')
  const [catalogPage, setCatalogPage] = useState(1)
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0)
  const [slideIndex, setSlideIndex] = useState(0)
  const [cart, setCart] = useState([])
  const [toast, setToast] = useState('')
  const [accountOpen, setAccountOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutPending, setCheckoutPending] = useState(false)

  useEffect(() => {
    function syncCustomerRoute() {
      setSelectedProductId(getProductIdFromPath())
      setCartPageOpen(isCartPath())
      setOrdersPageOpen(isOrdersPath())
    }

    window.addEventListener('popstate', syncCustomerRoute)
    return () => window.removeEventListener('popstate', syncCustomerRoute)
  }, [])

  useEffect(() => {
    let active = true
    fetchProductPage({
      page: catalogPage,
      perPage: PRODUCTS_PER_PAGE,
      search: searchQuery,
      categoryId: category,
      sort,
    })
      .then((result) => {
        if (active) {
          setCatalog(result.products)
          setPagination(result.pagination)
          if (
            result.pagination.total_pages > 0 &&
            catalogPage > result.pagination.total_pages
          ) {
            setCatalogPage(result.pagination.total_pages)
          }
        }
      })
      .catch((error) => {
        if (active) setCatalogError(error.message)
      })
      .finally(() => {
        if (active) setCatalogLoading(false)
      })
    return () => {
      active = false
    }
  }, [catalogPage, searchQuery, category, sort, catalogRefreshKey])

  useEffect(() => {
    let active = true
    fetchProductCategories()
      .then((result) => {
        if (active) setCategoryTree(result)
      })
      .catch((error) => {
        if (active) setToast(error.message)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    fetchProductPage({ page: 1, perPage: 4, sort: 'featured' })
      .then((result) => {
        if (active) {
          setFeaturedCatalog(result.products)
          setFeaturedError('')
        }
      })
      .catch((error) => {
        if (active) setFeaturedError(error.message)
      })
    return () => {
      active = false
    }
  }, [catalogRefreshKey])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setCatalogPage(1)
      setSearchQuery(search.trim())
    }, 350)

    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    let active = true
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

  const products = useMemo(() => catalog.map(mapCatalogProduct), [catalog])
  const featuredProducts = useMemo(
    () => featuredCatalog.map(mapCatalogProduct),
    [featuredCatalog],
  )
  const visibleCategories = useMemo(
    () => categoryTree.map((item) => ({
      id: String(item.id),
      name: item.name,
      icon: categoryIcons[item.name] || '✦',
    })),
    [categoryTree],
  )
  const categoryOptions = useMemo(
    () => flattenCategoryTree(categoryTree),
    [categoryTree],
  )
  const selectedCategory = categoryOptions.find(
    (item) => item.id === Number(category),
  )

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0)
  const cartTotal = cart.reduce((total, item) => total + item.product.price * item.quantity, 0)
  const currentSlide = slides[slideIndex]

  function openProduct(productId) {
    window.history.pushState({}, '', `/products/${productId}`)
    setSelectedProductId(String(productId))
    setCartPageOpen(false)
    setOrdersPageOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goHome() {
    window.history.pushState({}, '', '/')
    setSelectedProductId(null)
    setCartPageOpen(false)
    setOrdersPageOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openCartPage() {
    window.history.pushState({}, '', '/cart')
    setSelectedProductId(null)
    setCartPageOpen(true)
    setOrdersPageOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function changeCatalogPage(nextPage) {
    setCatalogLoading(true)
    setCatalogError('')
    setCatalogPage(nextPage)
    window.setTimeout(
      () => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }),
      0,
    )
  }

  function chooseCategory(nextCategory) {
    setCatalogLoading(true)
    setCatalogError('')
    const wasOnProductPage = Boolean(selectedProductId)
    if (wasOnProductPage) goHome()
    setCategory(nextCategory)
    setSearch('')
    setSearchQuery('')
    setCatalogPage(1)
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
    setCatalogLoading(true)
    setCatalogError('')
    if (selectedProductId) goHome()
    setCategory('all')
    setCatalogPage(1)
    setSearchQuery(search.trim())
    window.setTimeout(
      () => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }),
      0,
    )
  }

  function changeSearch(value) {
    setCatalogLoading(true)
    setCatalogError('')
    setSearch(value)
  }

  function changeSearchCategory(value) {
    setCatalogLoading(true)
    setCatalogError('')
    setCategory(value)
    setCatalogPage(1)
  }

  function searchTrendingTerm(term) {
    setCatalogLoading(true)
    setCatalogError('')
    setSearch(term)
    setSearchQuery(term)
    setCategory('all')
    setCatalogPage(1)
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
    const checkout = await createOrder({
      ...details,
      items: cart.map(({ product, quantity }) => ({
        product_id: product.id,
        quantity,
      })),
    })
    setCart([])
    setCheckoutOpen(false)
    setCatalogLoading(true)
    setCatalogError('')
    const orderNumbers = checkout.orders.map((order) => order.id).join(', ')
    setToast(`Đặt hàng thành công: ${orderNumbers}`)
    window.setTimeout(() => setToast(''), 4000)
    setCatalogRefreshKey((key) => key + 1)
  }

  function showCustomerOrders() {
    if (!customer) {
      setAccountOpen(true)
      return
    }
    window.history.pushState({}, '', '/orders')
    setSelectedProductId(null)
    setCartPageOpen(false)
    setOrdersPageOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className={`customer-store${selectedProductId ? ' customer-store--product-detail' : ''}`}>
      <CustomerUtilityBar
        customer={customer}
        onOrdersClick={showCustomerOrders}
        onLoginClick={() => setAccountOpen(true)}
        onLogout={handleLogout}
      />

      <CustomerMainHeader
        search={search}
        category={category}
        categories={categoryOptions}
        cartCount={cartCount}
        onHome={goHome}
        onSearchSubmit={handleSearch}
        onSearchChange={changeSearch}
        onCategoryChange={changeSearchCategory}
        onTrendingSearch={searchTrendingTerm}
        onOpenCart={openCartPage}
      />

      <main id="top">
        {ordersPageOpen ? (
          <CustomerOrdersPage onBack={goHome} />
        ) : selectedProductId ? (
          <ProductDetailPage
            key={selectedProductId}
            productId={selectedProductId}
            customerName={customer?.role === 'customer' ? customer.full_name : ''}
            onBack={goHome}
            onAddToCart={addToCart}
            onRequestLogin={() => setAccountOpen(true)}
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
            {visibleCategories.map((item) => (
              <button className={`category-link ${category === item.id ? 'active' : ''}`} data-category={item.id} key={item.id} type="button" onClick={() => chooseCategory(item.id)}>
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
            <HomeBenefits />
          </div>
        </section>

        <section className="container quick-categories">
          <div className="section-heading">
            <div><span className="section-kicker">KHÁM PHÁ</span><h2>Mua sắm theo danh mục</h2></div>
            <button className="text-link" type="button" onClick={() => chooseCategory('all')}>Xem tất cả →</button>
          </div>
          <div className="quick-grid">
            {visibleCategories.map((item, index) => (
              <button className="quick-category" data-category={item.id} key={item.id} type="button" onClick={() => chooseCategory(item.id)}>
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
          {featuredError ? (
            <div className="empty-state"><p>Không tải được sản phẩm nổi bật: {featuredError}</p></div>
          ) : (
          <div className="deal-grid">
            {featuredProducts.map((product) => (
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
                  {product.image ? <img src={product.image} alt={product.name} loading="lazy" decoding="async" /> : <span className="image-emoji">{product.emoji}</span>}
                </div>
                <h3>{product.name}</h3>
                <small className="product-store-label">{product.store?.name}</small>
                <div><span className="deal-price">{formatPrice(product.price)}</span></div>
                <div className="sold-text">Còn {product.stock} sản phẩm</div>
                <button className="add-cart deal-add-cart" type="button" disabled={product.stock === 0} onClick={(event) => { event.stopPropagation(); addToCart(product) }}>＋ Thêm vào giỏ</button>
              </article>
            ))}
          </div>
          )}
        </section>

        <section className="container products-section" id="products">
          <div className="products-heading">
            <div><span className="section-kicker">DÀNH RIÊNG CHO BẠN</span><h2>{search.trim() ? `Kết quả tìm kiếm: "${search.trim()}"` : category === 'all' ? 'Gợi ý hôm nay' : selectedCategory?.path || 'Danh mục'}</h2><p className="muted">Những sản phẩm đáng khám phá trên NOVIQ.</p></div>
            <div className="product-controls">
              <span className="product-result-count">{pagination.total_items} sản phẩm</span>
              <select aria-label="Sắp xếp sản phẩm" value={sort} onChange={(event) => {
                setCatalogLoading(true)
                setCatalogError('')
                setSort(event.target.value)
                setCatalogPage(1)
              }}>
                <option value="featured">Sắp xếp: Nổi bật</option><option value="priceAsc">Giá tăng dần</option><option value="priceDesc">Giá giảm dần</option>
              </select>
            </div>
          </div>
          <div className="filter-chips">
            <button className={`chip ${category === 'all' ? 'active' : ''}`} type="button" onClick={() => chooseCategory('all')}>Tất cả</button>
            {visibleCategories.slice(0, 5).map((item) => <button className={`chip ${category === item.id ? 'active' : ''}`} data-category={item.id} key={item.id} type="button" onClick={() => chooseCategory(item.id)}>{item.name}</button>)}
          </div>
          {catalogLoading ? (
            <div className="empty-state"><p>Đang tải sản phẩm...</p></div>
          ) : catalogError ? (
            <div className="empty-state"><h3>Không tải được sản phẩm</h3><p>{catalogError}</p></div>
          ) : products.length > 0 ? (
            <div className="product-grid">
              {products.map((product) => (
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
                    {product.image ? <img src={product.image} alt={product.name} loading="lazy" decoding="async" /> : <span className="image-emoji">{product.emoji}</span>}
                  </div>
                  <div className="product-info">
                    <h3>{product.name}</h3>
                    <small className="product-store-label">{product.store?.name}</small>
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
          {!catalogLoading && !catalogError && (
            <ProductPagination
              pagination={pagination}
              onPageChange={changeCatalogPage}
            />
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
          <div className="footer-brand"><a className="brand" href="/" onClick={(event) => { event.preventDefault(); goHome() }}><span className="brand-mark">N<span>✦</span></span><span className="brand-name"><span className="brand-word">NOVIQ</span><small>ONE PLATFORM. EVERY NEED.</small></span></a><p>Một điểm đến cho mọi nhu cầu mua sắm. Khám phá, lựa chọn và tận hưởng trải nghiệm mua sắm tiện lợi.</p></div>
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
      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">{toast}</div>
      <SupportChatWidget />
    </div>
  )
}

export default CustomerApp;
