import { formatMoney } from "./sellerData";

const statusLabels = {
  pending: "Chờ xác nhận",
  processing: "Đang xử lý",
  shipped: "Đang giao",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

const nextStatuses = {
  pending: ["pending", "processing", "cancelled"],
  processing: ["processing", "shipped", "cancelled"],
  shipped: ["shipped", "completed"],
  completed: ["completed"],
  cancelled: ["cancelled"],
};

export default function Orders({ orders, onChangeStatus }) {
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Danh sách đơn hàng</h2>
          <p>Theo dõi và cập nhật trạng thái đơn hàng.</p>
        </div>
      </div>
      <div className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>MÃ ĐƠN</th>
                <th>KHÁCH HÀNG</th>
                <th>NGÀY ĐẶT</th>
                <th>TỔNG TIỀN</th>
                <th>TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <b>{order.id}</b>
                  </td>
                  <td>{order.customer}</td>
                  <td>{order.date ? new Date(order.date).toLocaleString("vi-VN") : "—"}</td>
                  <td className="price-cell">{formatMoney(order.total)}</td>
                  <td>
                    <select
                      className="order-status"
                      value={order.status}
                      onChange={(event) =>
                        onChangeStatus(order.order_id, event.target.value)
                      }
                    >
                      {(nextStatuses[order.status] || [order.status]).map((status) => (
                        <option key={status} value={status}>{statusLabels[status] || status}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan="5" className="empty-state">Chưa có đơn hàng.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
