function storageKey(productId) {
  return `noviq:product-engagement:v1:${productId}`
}

function isValidEngagement(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof value.productLiked === 'boolean' &&
    Array.isArray(value.reviews) &&
    value.reviews.every(
      (review) =>
        review !== null &&
        typeof review === 'object' &&
        typeof review.id === 'string' &&
        typeof review.name === 'string' &&
        typeof review.comment === 'string' &&
        Number.isInteger(review.rating) &&
        review.rating >= 1 &&
        review.rating <= 5 &&
        typeof review.createdAt === 'string',
    )
  )
}

export function loadProductEngagement(productId) {
  const stored = window.localStorage.getItem(storageKey(productId))
  if (stored === null) {
    return { productLiked: false, reviews: [] }
  }

  const engagement = JSON.parse(stored)
  if (!isValidEngagement(engagement)) {
    throw new Error('Dữ liệu đánh giá đã lưu không hợp lệ. Hãy xóa dữ liệu website rồi thử lại.')
  }

  return engagement
}

export function saveProductEngagement(productId, engagement) {
  window.localStorage.setItem(storageKey(productId), JSON.stringify(engagement))
}
