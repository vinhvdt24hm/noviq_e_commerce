import { apiRequest } from "./http";

export async function fetchProducts() {
  const result = await apiRequest("/api/products/");
  return result.data;
}

export async function fetchProduct(productId) {
  const result = await apiRequest(`/api/products/${productId}`);
  return result.data;
}

export async function createProduct(product) {
  const result = await apiRequest("/api/products/", {
    method: "POST",
    body: product,
  });
  return result.data;
}

export async function updateProduct(productId, product) {
  const result = await apiRequest(`/api/products/${productId}`, {
    method: "PUT",
    body: product,
  });
  return result.data;
}

export async function deleteProduct(productId) {
  return apiRequest(`/api/products/${productId}`, { method: "DELETE" });
}

export async function updateProductStock(productId, stock) {
  const result = await apiRequest(`/api/products/${productId}/stock`, {
    method: "PATCH",
    body: { stock },
  });
  return result.data;
}

export async function fetchSellerOrders() {
  const result = await apiRequest("/api/orders/seller");
  return result.data;
}

export async function updateOrderStatus(orderId, status) {
  const result = await apiRequest(`/api/orders/${orderId}/status`, {
    method: "PATCH",
    body: { status },
  });
  return result.data;
}

export async function registerCustomer(details) {
  const result = await apiRequest("/api/auth/register", {
    method: "POST",
    body: details,
  });
  return result.data;
}

export async function login(details) {
  const result = await apiRequest("/api/auth/login", {
    method: "POST",
    body: details,
  });
  return result.data;
}

export async function logout() {
  return apiRequest("/api/auth/logout", { method: "POST" });
}

export async function fetchCurrentUser() {
  const result = await apiRequest("/api/auth/me");
  return result.data;
}

export async function createOrder(details) {
  const result = await apiRequest("/api/orders/", {
    method: "POST",
    body: details,
  });
  return result.data;
}

export async function fetchCustomerOrders() {
  const result = await apiRequest("/api/orders/");
  return result.data;
}
