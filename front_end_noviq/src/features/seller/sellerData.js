export const formatMoney = (value) =>
  new Intl.NumberFormat("vi-VN").format(value) + " ₫";
