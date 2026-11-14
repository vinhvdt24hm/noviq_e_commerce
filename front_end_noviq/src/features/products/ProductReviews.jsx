import { useState } from 'react'

export default function ProductReviews({
  customerName,
  reviews,
  reviewLoading,
  reviewError,
  onSubmitReview,
  onRequestLogin,
}) {
  const [reviewComment, setReviewComment] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [ratingFilter, setRatingFilter] = useState(0)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const averageRating = reviews.length
    ? reviews.reduce((total, review) => total + review.rating, 0) /
      reviews.length
    : 0
  const visibleReviews = reviews.filter(
    (review) => ratingFilter === 0 || review.rating === ratingFilter,
  )

  async function submitReview(event) {
    event.preventDefault()
    setFormError('')

    const comment = reviewComment.trim()
    if (!comment || comment.length > 1000) {
      setFormError('Vui lòng nhập nhận xét (tối đa 1000 ký tự).')
      return
    }

    setSubmitting(true)
    try {
      await onSubmitReview({ rating: reviewRating, comment })
      setReviewComment('')
      setRatingFilter(0)
    } catch (error) {
      setFormError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
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
          <small>{reviews.length} đánh giá</small>
        </div>
      </div>

      {reviewError && (
        <p className="product-review-error" role="alert">{reviewError}</p>
      )}

      <div className="product-reviews-content">
        <div className="product-reviews-feed">
          <div className="product-rating-filters" aria-label="Lọc đánh giá theo số sao">
            <button
              className={ratingFilter === 0 ? 'active' : ''}
              type="button"
              onClick={() => setRatingFilter(0)}
            >
              Tất cả ({reviews.length})
            </button>
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = reviews.filter(
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

          <div className="product-review-list">
            {reviewLoading ? (
              <p className="product-review-empty" role="status">Đang tải đánh giá...</p>
            ) : visibleReviews.length ? visibleReviews.map((review) => (
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
                {reviews.length
                  ? 'Không có đánh giá ở mức sao này.'
                  : 'Chưa có đánh giá. Hãy là người đầu tiên chia sẻ cảm nhận!'}
              </p>
            )}
          </div>
        </div>

        {customerName ? (
          <form className="product-review-form" onSubmit={submitReview}>
            <h3>Viết đánh giá của bạn</h3>
            <p className="product-review-author">Đánh giá với tư cách {customerName}</p>
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
            {formError && <p className="product-review-error" role="alert">{formError}</p>}
            <button className="add-cart product-review-submit" type="submit" disabled={submitting}>
              {submitting ? 'Đang gửi...' : 'Gửi đánh giá'}
            </button>
          </form>
        ) : (
          <aside className="product-review-form">
            <h3>Đăng nhập để đánh giá</h3>
            <p>Bạn cần tài khoản khách hàng để gửi đánh giá và bình luận.</p>
            <button className="add-cart product-review-submit" type="button" onClick={onRequestLogin}>
              Đăng nhập / Đăng ký
            </button>
          </aside>
        )}
      </div>
    </section>
  )
}
