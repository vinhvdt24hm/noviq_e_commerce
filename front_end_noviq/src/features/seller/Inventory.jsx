export default function Inventory({ products, onUpdateStock }) {
  const lowStock = products.filter(
    (product) => product.stock > 0 && product.stock <= 10,
  ).length;
  const outStock = products.filter((product) => product.stock === 0).length;

  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Tồn kho sản phẩm</h2>
          <p>Theo dõi số lượng và cập nhật hàng tồn.</p>
        </div>
      </div>
      <div className="inventory-summary">
        <div className="inventory-box">
          <span>Tổng sản phẩm</span>
          <b>{products.length}</b>
        </div>
        <div className="inventory-box">
          <span>Sắp hết hàng</span>
          <b className="warning-text">{lowStock}</b>
        </div>
        <div className="inventory-box">
          <span>Đã hết hàng</span>
          <b className="danger-text">{outStock}</b>
        </div>
      </div>
      <div className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SẢN PHẨM</th>
                <th>MÃ SẢN PHẨM</th>
                <th>SỐ LƯỢNG</th>
                <th>TRẠNG THÁI</th>
                <th>CẬP NHẬT KHO</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
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
                  <td>SP-{String(product.id).slice(-5)}</td>
                  <td>
                    <b>{product.stock}</b>
                  </td>
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
                          : "Còn hàng"}
                    </span>
                  </td>
                  <td>
                    <div className="stock-actions">
                      <button
                        onClick={() => onUpdateStock(product.id, -1)}
                        disabled={product.stock === 0}
                        aria-label={`Giảm tồn kho ${product.name}`}
                      >
                        −
                      </button>
                      <button
                        onClick={() => onUpdateStock(product.id, 1)}
                        aria-label={`Tăng tồn kho ${product.name}`}
                      >
                        +
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
