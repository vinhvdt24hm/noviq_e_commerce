import { useEffect, useState } from 'react'
import { fetchProduct } from '../../api/commerce'
import { formatPrice } from './formatPrice'
import {
  loadProductEngagement,
  saveProductEngagement,
} from './productReviews'

const placeholderImage = 'https://placehold.co/640x640?text=NOVIQ'

export default function ProductDetailPage({
  productId,
  customerName,
  onBack,
  onAddToCart,
}) {
  const [result, setResult] = useState(() => ({
    productId,
    product: null,
    loading: true,
    error: '',
  }))
  const [storedEngagement, setStoredEngagement] = useState(() => {
    try {
      return {
        engagement: loadProductEngagement(productId),
        error: '',
      }
    } catch (error) {
      return {
        engagement: { productLiked: false, reviews: [] },
        error: `Không tải được dữ liệu tương tác: ${error.message}`,
      }
    }
  })
  const { engagement, error: engagementError } = storedEngagement
  const [reviewName, setReviewName] = useState(null)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [ratingFilter, setRatingFilter] = useState(0)
  const [reviewError, setReviewError] = useState('')

  useEffect(() => {
    let active = true

    fetchProduct(productId)
      .then((product) => {
        if (active) {
          setResult({ productId, product, loading: false, error: '' })
        }
      })
      .catch((error) => {
        if (active) {
          setResult({
            productId,
            product: null,
            loading: false,
            error: error.message,
          })
        }
      })

    return () => {
      active = false
    }
  }, [productId])

  const isCurrentProduct = result.productId === productId
  const loading = !isCurrentProduct || result.loading
  const error = isCurrentProduct ? result.error : ''
  const product = isCurrentProduct ? result.product : null
  const averageRating = engagement.reviews.length
    ? engagement.reviews.reduce((total, review) => total + review.rating, 0) /
      engagement.reviews.length
    : 0
  const visibleReviews = engagement.reviews.filter(
    (review) => ratingFilter === 0 || review.rating === ratingFilter,
  )

  function updateEngagement(nextEngagement) {
    try {
      saveProductEngagement(productId, nextEngagement)
      setStoredEngagement({ engagement: nextEngagement, error: '' })
      return true
    } catch (error) {
      setStoredEngagement((current) => ({
        ...current,
        error: `Không thể lưu thay đổi trong trình duyệt: ${error.message}`,
      }))
      return false
    }
  }

  function toggleProductLike() {
    updateEngagement({
      ...engagement,
      productLiked: !engagement.productLiked,
    })
  }

  function submitReview(event) {
    event.preventDefault()
    setReviewError('')

    const name = (reviewName ?? customerName).trim()
    const comment = reviewComment.trim()
    if (!name || name.length > 100) {
      setReviewError('Vui lòng nhập tên (tối đa 100 ký tự).')
      return
    }
    if (!comment || comment.length > 1000) {
      setReviewError('Vui lòng nhập nhận xét (tối đa 1000 ký tự).')
      return
    }

    const review = {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      name,
      comment,
      rating: reviewRating,
      createdAt: new Date().toISOString(),
    }
    if (updateEngagement({
      ...engagement,
      reviews: [review, ...engagement.reviews],
    })) {
      setReviewName(null)
      setReviewComment('')
      setRatingFilter(0)
    }
  }

  return (
    <section className="container product-detail-page" aria-live="polite">
      <button className="product-detail-back" type="button" onClick={onBack}>
        ← Quay lại danh sách sản phẩm
      </button>

      {loading ? (
        <div className="empty-state"><p>Đang tải thông tin sản phẩm...</p></div>
      ) : error ? (
        <div className="empty-state">
          <h2>Không tải được sản phẩm</h2>
          <p>{error}</p>
        </div>
      ) : product ? (
        <div className="product-detail-card">
          <div className="product-detail-image">
            <img
              src={product.image_url || placeholderImage}
              alt={product.name}
              onError={(event) => {
                event.currentTarget.src = placeholderImage
              }}
            />
          </div>
          <div className="product-detail-info">
            <span className="section-kicker">{product.category || 'SẢN PHẨM'}</span>
            <h1>{product.name}</h1>
            <p className="product-detail-price">{formatPrice(product.price)}</p>
            <button
              className={`product-like-button${engagement.productLiked ? ' is-liked' : ''}`}
              type="button"
              aria-pressed={engagement.productLiked}
              onClick={toggleProductLike}
            >
              {engagement.productLiked ? '♥ Đã thích' : '♡ Like sản phẩm'}
            </button>
            <p className="product-detail-stock">
              {product.stock > 0
                ? `Còn ${product.stock} sản phẩm`
                : 'Sản phẩm hiện đang hết hàng'}
            </p>
            <div className="product-detail-description">
              <h2>Mô tả sản phẩm</h2>
              <p>{product.description || 'Chưa có mô tả cho sản phẩm này.'}</p>
            </div>
            <button
              className="add-cart product-detail-add"
              type="button"
              disabled={product.stock === 0}
              onClick={() => onAddToCart({
                ...product,
                image: product.image_url,
                emoji: '🛍️',
              })}
            >
              ＋ Thêm vào giỏ hàng
            </button>
          </div>
        </div>
      ) : null}

      {!loading && !error && product && (
        <section className="product-reviews" aria-labelledby="product-reviews-title">
          <div className="product-reviews-heading">
            <div>
              <span className="section-kicker">CẢM NHẬN KHÁCH HÀNG</span>
              <h2 id="product-reviews-title">Đánh giá và bình luận</h2>
            </div>
            <div className="product-rating-summary">
              <strong>{averageRating ? averageRating.toFixed(1) : '—'}</strong>
              <span className="product-stars" aria-label={`${averageRating.toFixed(1)} trên 5 sao`}>
                {'★'.repeat(Math.round(averageRating))}{'☆'.repeat(5 - Math.round(averageRating))}
              </span>
              <small>{engagement.reviews.length} đánh giá</small>
            </div>
          </div>

          <div className="product-rating-filters" aria-label="Lọc đánh giá theo số sao">
            <button
              className={ratingFilter === 0 ? 'active' : ''}
              type="button"
              onClick={() => setRatingFilter(0)}
            >
              Tất cả ({engagement.reviews.length})
            </button>
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = engagement.reviews.filter(
                (review) => review.rating === rating,
              ).length
              return (
                <button
                  className={ratingFilter === rating ? 'active' : ''}
                  key={rating}
                  type="button"
                  onClick={() => setRatingFilter(rating)}
                >
                  {rating} ★ ({count})
                </button>
              )
            })}
          </div>

          <form className="product-review-form" onSubmit={submitReview}>
            <h3>Viết đánh giá của bạn</h3>
            <label htmlFor="review-name">Tên hiển thị</label>
            <input
              id="review-name"
              value={reviewName ?? customerName}
              maxLength={100}
              onChange={(event) => setReviewName(event.target.value)}
              placeholder="Tên của bạn"
              required
            />
            <span className="product-review-label">Chọn số sao</span>
            <div className="product-review-star-picker" role="group" aria-label="Chọn số sao đánh giá">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  aria-label={`${rating} sao`}
                  aria-pressed={reviewRating === rating}
                  className={rating <= reviewRating ? 'selected' : ''}
                  key={rating}
                  onClick={() => setReviewRating(rating)}
                  type="button"
                >
                  ★
                </button>
              ))}
            </div>
            <label htmlFor="review-comment">Bình luận</label>
            <textarea
              id="review-comment"
              value={reviewComment}
              maxLength={1000}
              onChange={(event) => setReviewComment(event.target.value)}
              placeholder="Chia sẻ cảm nhận của bạn về sản phẩm..."
              rows={4}
              required
            />
            {reviewError && <p className="product-review-error" role="alert">{reviewError}</p>}
            <button className="add-cart product-review-submit" type="submit">
              Gửi đánh giá
            </button>
          </form>

          {engagementError && (
            <p className="product-review-error" role="alert">{engagementError}</p>
          )}

          <div className="product-review-list">
            {visibleReviews.length ? visibleReviews.map((review) => (
              <article className="product-review" key={review.id}>
                <div className="product-review-meta">
                  <strong>{review.name}</strong>
                  <time dateTime={review.createdAt}>
                    {new Date(review.createdAt).toLocaleDateString('vi-VN')}
                  </time>
                </div>
                <div className="product-stars" aria-label={`${review.rating} trên 5 sao`}>
                  {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                </div>
                <p>{review.comment}</p>
              </article>
            )) : (
              <p className="product-review-empty">
                {engagement.reviews.length
                  ? 'Không có đánh giá ở mức sao này.'
                  : 'Chưa có đánh giá. Hãy là người đầu tiên chia sẻ cảm nhận!'}
              </p>
            )}
          </div>
        </section>
      )}
    </section>
  )
}
