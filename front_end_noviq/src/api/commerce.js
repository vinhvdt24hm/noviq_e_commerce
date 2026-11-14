import { apiRequest } from "./http";

export async function fetchProducts() {
  const result = await apiRequest("/api/products/");
  return result.data;
}

export async function fetchProductPage({
  page = 1,
  perPage = 12,
  search = "",
  categoryId = "",
  sort = "featured",
} = {}) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
    sort,
  });
  if (search.trim()) params.set("search", search.trim());
  if (categoryId && categoryId !== "all") {
    params.set("category_id", categoryId);
  }

  const result = await apiRequest(`/api/products/?${params.toString()}`);
  if (
    !result ||
    !Array.isArray(result.data) ||
    !result.pagination ||
    !Array.isArray(result.categories)
  ) {
    throw new Error("Invalid paginated product response.");
  }

  return {
    products: result.data,
    pagination: result.pagination,
    categories: result.categories,
  };
}

export async function fetchProduct(productId) {
  const result = await apiRequest(`/api/products/${productId}`);
  return result.data;
}

export async function fetchProductReviews(productId) {
  const result = await apiRequest(`/api/products/${productId}/reviews`);
  return result;
}

export async function createProductReview(productId, review) {
  const result = await apiRequest(`/api/products/${productId}/reviews`, {
    method: "POST",
    body: review,
  });
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

export async function fetchSellerProducts() {
  const result = await apiRequest("/api/products/seller");
  return result.data;
}

export async function fetchSellerOrders() {
  const result = await apiRequest("/api/orders/seller");
  return result.data;
}

export async function fetchProductCategories() {
  const result = await apiRequest("/api/products/categories");
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
