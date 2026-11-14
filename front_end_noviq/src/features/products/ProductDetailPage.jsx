import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Heart,
  PackageCheck,
  ShoppingBag,
  Sparkles,
  Truck,
} from 'lucide-react'
import {
  createProductReview,
  fetchProduct,
  fetchProductReviews,
} from '../../api/commerce'
import { formatPrice } from '../../utils/formatPrice'
import ProductReviews from './ProductReviews.jsx'
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
  onRequestLogin,
}) {
  const [result, setResult] = useState(() => ({
    productId,
    product: null,
    loading: true,
    error: '',
  }))
  const [selectedImageUrl, setSelectedImageUrl] = useState('')
  const [galleryDirection, setGalleryDirection] = useState('next')
  const [galleryHasChanged, setGalleryHasChanged] = useState(false)
  const [productReviews, setProductReviews] = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [reviewsError, setReviewsError] = useState('')
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

  useEffect(() => {
    let active = true
    fetchProductReviews(productId)
      .then((result) => {
        if (active) {
          setProductReviews(result.data)
          setReviewsError('')
        }
      })
      .catch((error) => {
        if (active) setReviewsError(error.message)
      })
      .finally(() => {
        if (active) setReviewsLoading(false)
      })
    return () => {
      active = false
    }
  }, [productId])

  const isCurrentProduct = result.productId === productId
  const loading = !isCurrentProduct || result.loading
  const error = isCurrentProduct ? result.error : ''
  const product = isCurrentProduct ? result.product : null
  const imageUrls = product
    ? product.images?.length
      ? product.images
      : product.image_url
        ? [product.image_url]
        : []
    : []
  const selectedImageIndex = Math.max(imageUrls.indexOf(selectedImageUrl), 0)
  const selectedImage = imageUrls[selectedImageIndex] || placeholderImage

  function moveGallery(direction) {
    if (imageUrls.length < 2) return
    const nextIndex = (selectedImageIndex + direction + imageUrls.length) % imageUrls.length
    setGalleryDirection(direction > 0 ? 'next' : 'previous')
    setGalleryHasChanged(true)
    setSelectedImageUrl(imageUrls[nextIndex])
  }

  function selectGalleryImage(index) {
    if (index === selectedImageIndex) return

    const forwardDistance = (index - selectedImageIndex + imageUrls.length) % imageUrls.length
    setGalleryDirection(forwardDistance <= imageUrls.length / 2 ? 'next' : 'previous')
    setGalleryHasChanged(true)
    setSelectedImageUrl(imageUrls[index])
  }

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

  async function submitProductReview(review) {
    const savedReview = await createProductReview(productId, review)
    setProductReviews((current) => [savedReview, ...current])
    return savedReview
  }

  const category = product?.category || 'Sản phẩm'

  return (
    <section className="container product-detail-page" aria-live="polite">
      <div className="product-detail-breadcrumb">
        <button className="product-detail-back" type="button" onClick={onBack}>
          <ArrowLeft size={17} />
          <span>Tiếp tục mua sắm</span>
        </button>
        {product && (
          <span className="product-detail-breadcrumb-current">
            <span aria-hidden="true">/</span>
            {category}
          </span>
        )}
      </div>

      {loading ? (
        <div className="product-detail-loading" role="status">
          <span className="product-detail-loading-image" />
          <span className="product-detail-loading-info">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="visually-hidden">Đang tải thông tin sản phẩm...</span>
        </div>
      ) : error ? (
        <div className="product-detail-state">
          <h1>Không tải được sản phẩm</h1>
          <p>{error}</p>
          <button className="product-detail-state-button" type="button" onClick={onBack}>
            <ArrowLeft size={16} /> Quay lại cửa hàng
          </button>
        </div>
      ) : product ? (
        <>
          <div className="product-detail-card">
            <div className="product-detail-gallery">
              <div className="product-detail-image">
                <span className="product-detail-image-badge">
                  <Sparkles size={14} /> Chi tiết sản phẩm
                </span>
                <img
                  key={`${selectedImageIndex}-${selectedImage}`}
                  className={`product-gallery-main-image${galleryHasChanged ? ` is-entering-${galleryDirection}` : ''}`}
                  src={selectedImage}
                  alt={`${product.name} - Ảnh ${selectedImageIndex + 1}`}
                  onError={(event) => {
                    event.currentTarget.src = placeholderImage
                  }}
                />
                {imageUrls.length > 1 && (
                  <>
                    <button
                      className="product-gallery-arrow product-gallery-previous"
                      type="button"
                      aria-label="Xem ảnh trước"
                      onClick={() => moveGallery(-1)}
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      className="product-gallery-arrow product-gallery-next"
                      type="button"
                      aria-label="Xem ảnh tiếp theo"
                      onClick={() => moveGallery(1)}
                    >
                      <ChevronRight size={20} />
                    </button>
                    <span className="product-gallery-counter" aria-live="polite">
                      {selectedImageIndex + 1} / {imageUrls.length}
                    </span>
                  </>
                )}
              </div>
              {imageUrls.length > 1 && (
                <div className="product-detail-thumbnails" aria-label="Chọn ảnh sản phẩm">
                  {imageUrls.map((imageUrl, index) => (
                    <button
                      className={`product-detail-thumbnail${index === selectedImageIndex ? ' is-selected' : ''}`}
                      key={imageUrl}
                      type="button"
                      aria-label={`Xem ảnh ${index + 1}`}
                      aria-pressed={index === selectedImageIndex}
                      onClick={() => selectGalleryImage(index)}
                    >
                      <img src={imageUrl} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
              <p className="product-detail-image-caption">
                <PackageCheck size={16} />
                <span>Thông tin sản phẩm được cập nhật từ cửa hàng</span>
              </p>
            </div>

            <div className="product-detail-info">
              <div className="product-detail-info-top">
                <span className="product-detail-category">{category}</span>
                <button
                  className={`product-like-button${engagement.productLiked ? ' is-liked' : ''}`}
                  type="button"
                  aria-label={engagement.productLiked ? 'Bỏ thích sản phẩm' : 'Thích sản phẩm'}
                  aria-pressed={engagement.productLiked}
                  onClick={toggleProductLike}
                >
                  <Heart
                    size={18}
                    fill={engagement.productLiked ? 'currentColor' : 'none'}
                  />
                </button>
              </div>

              <h1>{product.name}</h1>
              <p className="product-detail-store">
                Cửa hàng: {product.store?.name || 'NOVIQ'}
              </p>
              <div className="product-detail-price-card">
                <span>Giá bán</span>
                <strong>{formatPrice(product.price)}</strong>
              </div>

              <div
                className={`product-detail-stock${product.stock > 0 ? ' is-available' : ' is-unavailable'}`}
                role="status"
              >
                <BadgeCheck size={17} />
                <span>
                  {product.stock > 0
                    ? `Còn ${product.stock} sản phẩm trong kho`
                    : 'Sản phẩm hiện đang hết hàng'}
                </span>
              </div>

              <div className="product-detail-description">
                <h2>Mô tả sản phẩm</h2>
                <p>{product.description || 'Chưa có mô tả cho sản phẩm này.'}</p>
              </div>

              <div className="product-detail-benefits">
                <div>
                  <span className="product-benefit-icon"><Truck size={18} /></span>
                  <span><strong>Giao hàng tận nơi</strong><small>Nhập địa chỉ nhận hàng khi đặt đơn</small></span>
                </div>
                <div>
                  <span className="product-benefit-icon"><CreditCard size={18} /></span>
                  <span><strong>Thanh toán khi nhận hàng</strong><small>Hiện hỗ trợ hình thức COD</small></span>
                </div>
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
                <ShoppingBag size={18} />
                {product.stock > 0 ? 'Thêm vào giỏ hàng' : 'Tạm hết hàng'}
              </button>
            </div>
          </div>

          <ProductReviews
            customerName={customerName}
            reviews={productReviews}
            reviewLoading={reviewsLoading}
            reviewError={reviewsError || engagementError}
            onSubmitReview={submitProductReview}
            onRequestLogin={onRequestLogin}
          />
        </>
      ) : null}
    </section>
  )
}
