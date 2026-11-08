import { useMemo, useState } from "react";
import {
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { formatMoney } from "./sellerData";

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
  const [form, setForm] = useState({
    name: product?.name || "",
    category: product?.category || "Thời trang",
    price: product?.price || "",
    stock: product?.stock ?? "",
    image_url: product?.image || product?.image_url || "",
    description: product?.description || "",
  });

  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function submit(event) {
    event.preventDefault();
    if (
      !form.name.trim() ||
      Number(form.price) <= 0 ||
      form.stock === "" ||
      Number(form.stock) < 0
    ) {
      alert("Vui lòng nhập tên, giá bán hợp lệ và số lượng tồn kho.");
      return;
    }

    onSave({
      ...form,
      id: product?.id,
      price: Number(form.price),
      stock: Number(form.stock),
    });
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
            <select name="category" value={form.category} onChange={change}>
              {[
                "Thời trang",
                "Phụ kiện",
                "Giày dép",
                "Đời sống",
                "Điện tử",
                "Mỹ phẩm",
                "Khác",
              ].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>

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
            <p className="form-hint">Nhập URL ảnh công khai. Upload Cloud Storage sẽ được bổ sung khi cấu hình bucket.</p>
            <label htmlFor="product-image-url">URL hình ảnh</label>
            <input
              id="product-image-url"
              name="image_url"
              type="url"
              value={form.image_url}
              onChange={change}
              placeholder="https://example.com/product.jpg"
            />
            {form.image_url && (
              <div className="image-upload">
                <img src={form.image_url} alt="Xem trước sản phẩm" />
              </div>
            )}
          </div>
          <div className="form-note">
            <b>Gợi ý</b>
            <p>
              Dùng URL ảnh ổn định để ảnh vẫn hiển thị sau khi tải lại trang.
            </p>
          </div>
        </div>

        <div className="form-footer">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Hủy
          </button>
          <button type="submit" className="primary-button">
            {product?.id ? "Lưu thay đổi" : "Thêm sản phẩm"}
          </button>
        </div>
      </form>
    </>
  );
}
