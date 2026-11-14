import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { formatMoney } from "./sellerData";
import { fetchProductCategories } from "../../api/commerce";

const MAX_PRODUCT_IMAGES = 10;
const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_TOTAL_SIZE = 25 * 1024 * 1024;

function findCategoryPath(categories, categoryId) {
  for (const category of categories) {
    if (String(category.id) === String(categoryId)) return [category.id];
    const childPath = findCategoryPath(category.children || [], categoryId);
    if (childPath.length) return [category.id, ...childPath];
  }
  return [];
}

export function Products({
  products,
  keyword,
  setKeyword,
  onAdd,
  onEdit,
  onDelete,
}) {
  const [category, setCategory] = useState("Tất cả");
  const filtered = useMemo(
    () =>
      products.filter(
        (product) =>
          product.name.toLowerCase().includes(keyword.toLowerCase()) &&
          (category === "Tất cả" || product.category === category),
      ),
    [products, keyword, category],
  );
  const categories = ["Tất cả", ...new Set(products.map((p) => p.category))];

  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Danh sách sản phẩm</h2>
          <p>Quản lý thông tin và trạng thái sản phẩm của gian hàng.</p>
        </div>
        <button className="primary-button" onClick={onAdd}>
          <Plus size={18} /> Thêm sản phẩm
        </button>
      </div>

      <div className="filter-bar">
        <div className="search-box">
          <Search size={18} />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm kiếm sản phẩm..."
          />
        </div>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <span className="result-count">{filtered.length} sản phẩm</span>
      </div>

      <div className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SẢN PHẨM</th>
                <th>DANH MỤC</th>
                <th>GIÁ BÁN</th>
                <th>TỒN KHO</th>
                <th>TRẠNG THÁI</th>
                <th>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="table-product">
                      <img
                        src={
                          product.image ||
                          "https://placehold.co/80x80?text=NOVIQ"
                        }
                        alt={product.name}
                      />
                      <b>{product.name}</b>
                    </div>
                  </td>
                  <td>{product.category}</td>
                  <td className="price-cell">{formatMoney(product.price)}</td>
                  <td>{product.stock}</td>
                  <td>
                    <span
                      className={`status ${
                        product.stock === 0
                          ? "status-red"
                          : product.stock <= 10
                            ? "status-yellow"
                            : "status-green"
                      }`}
                    >
                      {product.stock === 0
                        ? "Hết hàng"
                        : product.stock <= 10
                          ? "Sắp hết"
                          : "Đang bán"}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        title="Chỉnh sửa"
                        onClick={() => onEdit(product)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="delete-action"
                        title="Xóa"
                        onClick={() => onDelete(product.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-state">
                    Không tìm thấy sản phẩm phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function ProductForm({ product, onSave, onCancel }) {
  const productImages =
    Array.isArray(product?.images) && product.images.length > 0
      ? product.images
      : [product?.image || product?.image_url || ""].filter(Boolean)
  const [form, setForm] = useState({
    name: product?.name || "",
    price: product?.price || "",
    stock: product?.stock ?? "",
    image_urls: productImages.join("\n"),
    description: product?.description || "",
  });
  const [categories, setCategories] = useState([]);
  const [categoryPath, setCategoryPath] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState("");
  const [imageFiles, setImageFiles] = useState([]);
  const imageFilesRef = useRef([]);
  const [imageError, setImageError] = useState("");
  const [saving, setSaving] = useState(false);
  const previewImageUrls = form.image_urls
    .split(/[\r\n\t]+/)
    .map((imageUrl) => imageUrl.trim())
    .filter(Boolean);

  useEffect(() => {
    let active = true;
    fetchProductCategories()
      .then((result) => {
        if (!active) return;
        setCategories(result);
        if (product?.category_id) {
          setCategoryPath(findCategoryPath(result, product.category_id));
        }
      })
      .catch((error) => {
        if (active) setCategoriesError(error.message);
      })
      .finally(() => {
        if (active) setCategoriesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [product?.category_id]);

  const categorySelects = [];
  let categoryOptions = categories;
  for (const categoryId of categoryPath) {
    categorySelects.push({ options: categoryOptions, value: String(categoryId) });
    categoryOptions =
      categoryOptions.find((item) => item.id === categoryId)?.children || [];
  }
  if (categoryPath.length === 0 || categoryOptions.length > 0) {
    categorySelects.push({ options: categoryOptions, value: "" });
  }

  useEffect(
    () => () => {
      imageFilesRef.current.forEach(({ previewUrl }) =>
        URL.revokeObjectURL(previewUrl),
      );
    },
    [],
  );

  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function addImageFiles(event) {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selectedFiles.length) return;

    const existingUrlCount = form.image_urls
      .split(/[\r\n\t]+/)
      .map((imageUrl) => imageUrl.trim())
      .filter(Boolean).length;
    if (existingUrlCount + imageFiles.length + selectedFiles.length > MAX_PRODUCT_IMAGES) {
      setImageError("Một sản phẩm chỉ được có tối đa 10 ảnh.");
      return;
    }
    if (selectedFiles.some((file) => file.size > MAX_IMAGE_FILE_SIZE)) {
      setImageError("Mỗi ảnh phải có dung lượng tối đa 5 MB.");
      return;
    }
    const totalSize = [
      ...imageFiles.map(({ file }) => file),
      ...selectedFiles,
    ].reduce(
      (total, file) => total + file.size,
      0,
    );
    if (totalSize > MAX_IMAGE_TOTAL_SIZE) {
      setImageError("Tổng dung lượng ảnh tải lên không được quá 25 MB.");
      return;
    }

    setImageError("");
    const newImages = selectedFiles.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    imageFilesRef.current = [...imageFilesRef.current, ...newImages];
    setImageFiles(imageFilesRef.current);
  }

  function removeImageFile(imageToRemove) {
    URL.revokeObjectURL(imageToRemove.previewUrl);
    imageFilesRef.current = imageFilesRef.current.filter(
      (image) => image !== imageToRemove,
    );
    setImageFiles(imageFilesRef.current);
  }

  async function submit(event) {
    event.preventDefault();
    const imageUrls = form.image_urls
      .split(/[\r\n\t]+/)
      .map((imageUrl) => imageUrl.trim())
      .filter(Boolean);

    if (
      !form.name.trim() ||
      categoryPath.length === 0 ||
      Number(form.price) <= 0 ||
      form.stock === "" ||
      Number(form.stock) < 0
    ) {
      alert("Vui lòng chọn danh mục và nhập tên, giá bán, tồn kho hợp lệ.");
      return;
    }
    const invalidImageIndex = imageUrls.findIndex((imageUrl) => {
      try {
        const url = new URL(imageUrl);
        return !["http:", "https:"].includes(url.protocol);
      } catch {
        return true;
      }
    });
    if (imageUrls.length + imageFiles.length > MAX_PRODUCT_IMAGES) {
      setImageError("Một sản phẩm chỉ được có tối đa 10 ảnh.");
      return;
    }
    if (invalidImageIndex !== -1) {
      alert(`URL ảnh thứ ${invalidImageIndex + 1} không hợp lệ. Vui lòng dùng URL bắt đầu bằng http:// hoặc https://.`);
      return;
    }
    if (new Set(imageUrls).size !== imageUrls.length) {
      alert("URL ảnh không được trùng nhau.");
      return;
    }

    setImageError("");
    setSaving(true);
    try {
      await onSave({
        ...form,
        id: product?.id,
        category_id: categoryPath[categoryPath.length - 1],
        image_url: imageUrls[0] || "",
        image_urls: imageUrls,
        image_files: imageFiles.map(({ file }) => file),
        price: Number(form.price),
        stock: Number(form.stock),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="section-heading">
        <div>
          <h2>{product?.id ? "Cập nhật sản phẩm" : "Thông tin sản phẩm"}</h2>
          <p>Điền thông tin để quản lý sản phẩm trong gian hàng.</p>
        </div>
        <button className="secondary-button" onClick={onCancel}>
          Quay lại
        </button>
      </div>

      <form className="product-form panel" onSubmit={submit}>
        <div className="form-main">
          <div className="form-section">
            <h3>Thông tin cơ bản</h3>
            <label>
              Tên sản phẩm <em>*</em>
            </label>
            <input
              name="name"
              value={form.name}
              onChange={change}
              placeholder="Nhập tên sản phẩm"
              required
            />

            <label>
              Danh mục <em>*</em>
            </label>
            {categorySelects.map(({ options, value }, index) => (
              <select
                aria-label={`Danh mục cấp ${index + 1}`}
                key={index}
                value={value}
                onChange={(event) => {
                  const nextPath = categoryPath.slice(0, index);
                  if (event.target.value) {
                    nextPath.push(Number(event.target.value));
                  }
                  setCategoryPath(nextPath);
                }}
                disabled={categoriesLoading || options.length === 0}
              >
                <option value="">Chọn danh mục</option>
                {options.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            ))}
            {categoriesError && (
              <p className="product-image-error" role="alert">{categoriesError}</p>
            )}

            <div className="form-two">
              <div>
                <label>
                  Giá bán (VNĐ) <em>*</em>
                </label>
                <input
                  name="price"
                  type="number"
                  min="1"
                  value={form.price}
                  onChange={change}
                  placeholder="Ví dụ: 199000"
                  required
                />
              </div>
              <div>
                <label>
                  Số lượng tồn kho <em>*</em>
                </label>
                <input
                  name="stock"
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={change}
                  placeholder="Nhập số lượng"
                  required
                />
              </div>
            </div>

            <label>Mô tả sản phẩm</label>
            <textarea
              name="description"
              rows="5"
              value={form.description}
              onChange={change}
              placeholder="Mô tả đặc điểm, chất liệu, kích thước..."
            />
          </div>
        </div>

        <div className="form-side">
          <div className="form-section">
            <h3>Hình ảnh sản phẩm</h3>
            <p className="form-hint">
              Chọn ảnh từ máy hoặc nhập URL. Tối đa 10 ảnh; ảnh đầu tiên làm ảnh bìa.
            </p>
            <input
              className="product-image-file-input"
              id="product-image-files"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={addImageFiles}
              disabled={saving}
            />
            <label className="image-upload" htmlFor="product-image-files">
              <Upload size={24} aria-hidden="true" />
              <b>Chọn ảnh từ máy</b>
              <small>JPG, PNG hoặc WebP · tối đa 5 MB mỗi ảnh, 25 MB tổng</small>
            </label>
            {imageError && (
              <p className="product-image-error" role="alert">{imageError}</p>
            )}
            <label htmlFor="product-image-urls">URL ảnh (tùy chọn, mỗi URL một dòng)</label>
            <textarea
              id="product-image-urls"
              name="image_urls"
              rows="5"
              value={form.image_urls}
              onChange={change}
              placeholder={
                "https://example.com/product-front.jpg\nhttps://example.com/product-side.jpg"
              }
            />
            {(previewImageUrls.length > 0 || imageFiles.length > 0) && (
              <div
                className="product-image-gallery-preview"
                aria-label="Xem trước thư viện ảnh"
              >
                {previewImageUrls.map((imageUrl, index) => (
                  <figure key={`${index}-${imageUrl}`}>
                    <img src={imageUrl} alt={`Ảnh sản phẩm ${index + 1}`} />
                    {index === 0 && <figcaption>Ảnh bìa</figcaption>}
                  </figure>
                ))}
                {imageFiles.map(({ file, previewUrl }, index) => {
                  const imageIndex = previewImageUrls.length + index;
                  return (
                    <figure key={`${file.name}-${file.lastModified}-${index}`}>
                      <img src={previewUrl} alt={`Ảnh tải lên ${imageIndex + 1}`} />
                      <figcaption>{file.name}</figcaption>
                      <button
                        type="button"
                        className="remove-image"
                        aria-label={`Bỏ ảnh ${file.name}`}
                        onClick={() =>
                          removeImageFile(imageFiles[index])
                        }
                        disabled={saving}
                      >
                        <X size={14} />
                      </button>
                    </figure>
                  );
                })}
              </div>
            )}
          </div>
          <div className="form-note">
            <b>Gợi ý</b>
            <p>
              Ảnh đã chọn sẽ được tải lên Cloud Storage khi lưu sản phẩm.
            </p>
          </div>
        </div>

        <div className="form-footer">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Hủy
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Đang lưu..." : product?.id ? "Lưu thay đổi" : "Thêm sản phẩm"}
          </button>
        </div>
      </form>
    </>
  );
}
