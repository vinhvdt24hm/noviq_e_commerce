import { Search, ShoppingCart, Sparkles } from 'lucide-react'

const trendingSearches = ['tai nghe', 'áo thun', 'bình giữ nhiệt', 'đèn bàn']

export default function CustomerMainHeader({
  search,
  category,
  categories,
  cartCount,
  onHome,
  onSearchSubmit,
  onSearchChange,
  onCategoryChange,
  onTrendingSearch,
  onOpenCart,
}) {
  return (
    <header className="customer-main-header">
      <div className="container customer-main-header__main">
        <a
          className="customer-main-header__brand"
          href="/"
          onClick={(event) => {
            event.preventDefault()
            onHome()
          }}
          aria-label="NOVIQ - Trang chủ"
        >
          <span className="customer-main-header__brand-mark" aria-hidden="true">
            N<span>✦</span>
          </span>
          <span className="customer-main-header__brand-copy">
            <span className="customer-main-header__brand-name">NOVIQ</span>
            <span className="customer-main-header__brand-tagline">
              ONE PLATFORM. EVERY NEED.
            </span>
          </span>
        </a>

        <form className="customer-main-header__search" onSubmit={onSearchSubmit}>
          <Search
            className="customer-main-header__search-icon"
            size={18}
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Tìm sản phẩm, thương hiệu và danh mục..."
            aria-label="Tìm kiếm sản phẩm"
          />
          <select
            aria-label="Danh mục tìm kiếm"
            value={category}
            onChange={(event) => onCategoryChange(event.target.value)}
          >
            <option value="all">Tất cả</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>{item.path}</option>
            ))}
          </select>
          <button type="submit" className="customer-main-header__search-button">
            <Search size={17} aria-hidden="true" />
            <span>Tìm kiếm</span>
          </button>
        </form>

        <button
          className="customer-main-header__cart"
          type="button"
          onClick={onOpenCart}
          aria-label={`Mở giỏ hàng, ${cartCount} sản phẩm`}
        >
          <span className="customer-main-header__cart-icon" aria-hidden="true">
            <ShoppingCart size={20} />
          </span>
          <span className="customer-main-header__cart-label">Giỏ hàng</span>
          <span className="customer-main-header__cart-count">{cartCount}</span>
        </button>
      </div>

      <nav
        className="customer-main-header__trends"
        aria-label="Tìm kiếm xu hướng"
      >
        <div className="container customer-main-header__trends-inner">
          <span className="customer-main-header__trends-label">
            <Sparkles size={14} aria-hidden="true" />
            Xu hướng
          </span>
          <div className="customer-main-header__trend-list">
            {trendingSearches.map((term) => (
              <button
                className="customer-main-header__trend"
                key={term}
                type="button"
                onClick={() => onTrendingSearch(term)}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </nav>
    </header>
  )
}
