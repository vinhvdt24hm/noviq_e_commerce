import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createProduct,
  deleteProduct as deleteProductRequest,
  fetchCurrentUser,
  fetchSellerProducts,
  fetchSellerOrders,
  login,
  logout,
  updateOrderStatus as updateSellerOrderStatus,
  updateProduct,
  updateProductStock,
} from "../../api/commerce";
import Dashboard from "./Dashboard";
import Inventory from "./Inventory";
import Orders from "./Orders";
import { ProductForm, Products } from "./ProductManagement";
import SellerLayout from "./SellerLayout";
import SellerLogin from "./SellerLogin";
import { buildSellerNotificationItems } from "./sellerNotificationData";
import "../../app/App.css";

function mapProduct(product) {
  return { ...product, image: product.image_url };
}

function App() {
  const [page, setPage] = useState("dashboard");
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [editing, setEditing] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshSellerData = useCallback(async () => {
    const [productData, orderData] = await Promise.all([
      fetchSellerProducts(),
      fetchSellerOrders(),
    ]);
    setProducts(
      productData
        .filter((product) => product.is_active !== false)
        .map(mapProduct),
    );
    setOrders(orderData);
  }, []);

  const loadSellerData = useCallback(async () => {
    setDataLoading(true);
    setError("");
    try {
      await refreshSellerData();
    } finally {
      setDataLoading(false);
    }
  }, [refreshSellerData]);

  useEffect(() => {
    if (!seller) return undefined;
    const intervalId = window.setInterval(() => {
      refreshSellerData().catch((requestError) => {
        setError(requestError.message);
      });
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, [seller, refreshSellerData]);

  async function reloadSellerData() {
    try {
      await loadSellerData();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => {
    let active = true;
    fetchCurrentUser()
      .then(async (currentUser) => {
        if (!active || !currentUser) return;
        if (currentUser.role !== "seller") {
          setError("Tài khoản hiện tại không có quyền truy cập Seller Center.");
          return;
        }
        setSeller(currentUser);
        await loadSellerData();
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadSellerData]);

  const lowStock = products.filter(
    (product) => product.stock > 0 && product.stock <= 10,
  ).length;
  const outStock = products.filter((product) => product.stock === 0).length;
  const notifications = useMemo(
    () => buildSellerNotificationItems(orders, products),
    [orders, products],
  );

  function navigate(nextPage) {
    setPage(nextPage);
    setEditing(null);
  }

  async function handleLogin(credentials) {
    setError("");
    try {
      const account = await login(credentials);
      if (account.role !== "seller") {
        await logout();
        setError("Tài khoản này không có quyền người bán.");
        return;
      }
      setSeller(account);
      await loadSellerData();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleLogout() {
    try {
      await logout();
      setSeller(null);
      setProducts([]);
      setOrders([]);
      setPage("dashboard");
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function saveProduct(product) {
    setError("");
    const imageFiles = product.image_files || [];
    const payload = {
      name: product.name,
      category_id: product.category_id || null,
      price: product.price,
      stock: product.stock,
      description: product.description,
      image_url: product.image_urls?.[0] || product.image_url,
      image_urls: product.image_urls,
    };
    try {
      let requestBody = payload;
      if (imageFiles.length > 0) {
        requestBody = new FormData();
        requestBody.append("product", JSON.stringify(payload));
        imageFiles.forEach((file) => requestBody.append("images", file));
      }
      const saved = product.id
        ? await updateProduct(product.id, requestBody)
        : await createProduct(requestBody);
      const mapped = mapProduct(saved);
      setProducts((current) =>
        product.id
          ? current.map((item) => (item.id === mapped.id ? mapped : item))
          : [mapped, ...current],
      );
      setEditing(null);
      setPage("products");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function deleteProduct(id) {
    if (!window.confirm("Bạn có chắc muốn xóa sản phẩm này?")) return;
    setError("");
    try {
      await deleteProductRequest(id);
      setProducts((current) => current.filter((product) => product.id !== id));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function changeStock(id, amount) {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    setError("");
    try {
      const updated = await updateProductStock(
        id,
        Math.max(0, Number(product.stock) + amount),
      );
      const mapped = mapProduct(updated);
      setProducts((current) =>
        current.map((item) => (item.id === id ? mapped : item)),
      );
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function changeOrderStatus(orderId, status) {
    setError("");
    try {
      const updated = await updateSellerOrderStatus(orderId, status);
      setOrders((current) =>
        current.map((order) =>
          order.order_id === updated.order_id ? updated : order,
        ),
      );
      if (status === "cancelled") {
        try {
          setProducts((await fetchSellerProducts()).filter(
            (product) => product.is_active !== false,
          ).map(mapProduct));
        } catch (requestError) {
          setError(
            `Order status was updated, but inventory could not be refreshed: ${requestError.message}`,
          );
        }
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (!seller || authLoading) {
    return (
      <SellerLogin
        onLogin={handleLogin}
        error={error}
        loading={authLoading}
      />
    );
  }

  const title =
    page === "form"
      ? editing?.id
        ? "Chỉnh sửa sản phẩm"
        : "Thêm sản phẩm mới"
      : {
          dashboard: "Tổng quan",
          products: "Quản lý sản phẩm",
          inventory: "Quản lý kho hàng",
          orders: "Quản lý đơn hàng",
        }[page] || "Seller Center";

  return (
    <SellerLayout
      page={page}
      title={title}
      alertCount={lowStock + outStock}
      seller={seller}
      notifications={notifications}
      onLogout={handleLogout}
      onNavigate={navigate}
    >
      {error && (
        <div className="seller-api-error" role="alert">
          <span>{error}</span>{" "}
          <button type="button" onClick={reloadSellerData}>Tải lại dữ liệu</button>
        </div>
      )}
      {dataLoading && <p>Đang tải dữ liệu...</p>}
      {page === "dashboard" && (
        <Dashboard
          products={products}
          orders={orders}
          lowStock={lowStock}
          outStock={outStock}
          seller={seller}
          onNavigate={navigate}
        />
      )}

      {page === "products" && !editing && (
        <Products
          products={products}
          keyword={keyword}
          setKeyword={setKeyword}
          onAdd={() => {
            setEditing({});
            setPage("form");
          }}
          onEdit={(product) => {
            setEditing(product);
            setPage("form");
          }}
          onDelete={deleteProduct}
        />
      )}

      {(page === "form" || editing) && (
        <ProductForm
          product={editing}
          onSave={saveProduct}
          onCancel={() => {
            setEditing(null);
            setPage("products");
          }}
        />
      )}

      {page === "inventory" && (
        <Inventory products={products} onUpdateStock={changeStock} />
      )}

      {page === "orders" && (
        <Orders orders={orders} onChangeStatus={changeOrderStatus} />
      )}
    </SellerLayout>
  );
}

export default App;
