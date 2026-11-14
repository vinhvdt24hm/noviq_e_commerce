export function buildSellerNotificationItems(orders, products) {
  const pendingOrders = orders
    .filter((order) => order.status === "pending")
    .map((order) => {
      const timestamp = order.date ? new Date(order.date).getTime() : 0;
      const orderNumber = order.id || order.order_id;
      return {
        id: `order-${order.order_id}`,
        kind: "order",
        title: "Đơn hàng cần xác nhận",
        message: `Đơn #${orderNumber} đang chờ bạn xử lý.`,
        createdAt: Number.isFinite(timestamp) ? timestamp : 0,
        timeLabel: timestamp ? order.date : "",
        target: "orders",
      };
    });

  const stockAlerts = products
    .filter((product) => Number(product.stock) <= 10)
    .map((product) => {
      const stock = Number(product.stock);
      const isOutOfStock = stock === 0;
      return {
        id: `stock-${product.id}-${isOutOfStock ? "out" : "low"}`,
        kind: "stock",
        title: isOutOfStock ? "Sản phẩm đã hết hàng" : "Sắp hết hàng",
        message: isOutOfStock
          ? `${product.name} hiện không còn hàng.`
          : `${product.name} chỉ còn ${stock} sản phẩm.`,
        createdAt: 0,
        timeLabel: "Cần kiểm tra",
        target: "inventory",
      };
    });

  return [...pendingOrders, ...stockAlerts].sort(
    (first, second) => second.createdAt - first.createdAt,
  );
}
