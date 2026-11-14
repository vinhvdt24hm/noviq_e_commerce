const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
let csrfToken;

async function readJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed with status ${response.status}`);
  }
  return body;
}

async function getCsrfToken() {
  if (!csrfToken) {
    const response = await fetch(`${apiBaseUrl}/api/auth/csrf`, {
      credentials: "include",
    });
    const body = await readJson(response);
    csrfToken = body.csrf_token;
  }
  return csrfToken;
}

export async function apiRequest(path, { method = "GET", body, ...options } = {}) {
  const headers = new Headers(options.headers || {});
  const requestOptions = {
    ...options,
    method,
    headers,
    credentials: "include",
  };

  if (body !== undefined) {
    if (typeof FormData !== "undefined" && body instanceof FormData) {
      requestOptions.body = body;
    } else {
      headers.set("Content-Type", "application/json");
      requestOptions.body = JSON.stringify(body);
    }
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
    headers.set("X-CSRF-Token", await getCsrfToken());
  }

  let response = await fetch(`${apiBaseUrl}${path}`, requestOptions);
  if (response.status === 403 && requestOptions.headers.has("X-CSRF-Token")) {
    const body = await response.clone().json().catch(() => ({}));
    if (body.error === "Valid CSRF token required.") {
      csrfToken = undefined;
      headers.set("X-CSRF-Token", await getCsrfToken());
      response = await fetch(`${apiBaseUrl}${path}`, requestOptions);
    }
  }
  const result = await readJson(response);
  if (path.startsWith("/api/auth/")) {
    csrfToken = undefined;
  }
  return result;
}
