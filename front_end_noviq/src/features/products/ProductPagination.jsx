import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function ProductPagination({ pagination, onPageChange }) {
  if (!pagination || pagination.total_pages < 2) return null

  return (
    <nav className="product-pagination" aria-label="Phân trang sản phẩm">
      <button
        type="button"
        disabled={!pagination.has_prev}
        onClick={() => onPageChange(pagination.page - 1)}
      >
        <ChevronLeft size={16} />
        Trang trước
      </button>
      <span aria-live="polite">
        Trang <strong>{pagination.page}</strong> / {pagination.total_pages}
        <small>{pagination.total_items} sản phẩm</small>
      </span>
      <button
        type="button"
        disabled={!pagination.has_next}
        onClick={() => onPageChange(pagination.page + 1)}
      >
        Trang sau
        <ChevronRight size={16} />
      </button>
    </nav>
  )
}
