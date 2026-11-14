import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  ShoppingBag,
} from "lucide-react";

function storageKey(sellerId) {
  return `noviq:seller-notifications:v1:${sellerId}`;
}

function loadReadIds(key) {
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return new Set();
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) {
      return new Set(parsed);
    }
    console.error("Saved seller notification state is invalid.");
  } catch (error) {
    console.error("Could not load saved seller notifications.", error);
  }
  return new Set();
}

function formatNotificationTime(notification) {
  if (!notification.timeLabel || !notification.createdAt) {
    return notification.timeLabel || "Mới cập nhật";
  }
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(notification.createdAt));
}

export default function SellerNotifications({
  sellerId,
  notifications,
  onNavigate,
}) {
  const notificationStorageKey = storageKey(sellerId);
  const [isOpen, setIsOpen] = useState(false);
  const [readIds, setReadIds] = useState(() =>
    loadReadIds(notificationStorageKey),
  );
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const unreadCount = notifications.reduce(
    (count, notification) => count + (readIds.has(notification.id) ? 0 : 1),
    0,
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        notificationStorageKey,
        JSON.stringify([...readIds]),
      );
    } catch (error) {
      console.error("Could not save seller notification state.", error);
    }
  }, [notificationStorageKey, readIds]);

  useEffect(() => {
    if (!isOpen) return undefined;

    function closeOnOutsideClick(event) {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  function markRead(notificationId) {
    setReadIds((current) => new Set(current).add(notificationId));
  }

  function markAllRead() {
    setReadIds(new Set(notifications.map((notification) => notification.id)));
  }

  function openNotification(notification) {
    markRead(notification.id);
    setIsOpen(false);
    onNavigate(notification.target);
  }

  return (
    <div className="notification-center" ref={containerRef}>
      <button
        ref={buttonRef}
        className="icon-button notification-button"
        type="button"
        title="Thông báo"
        aria-label={
          unreadCount > 0
            ? `Thông báo, ${unreadCount} mục chưa đọc`
            : "Thông báo"
        }
        aria-expanded={isOpen}
        aria-controls="seller-notification-panel"
        onClick={() => setIsOpen((open) => !open)}
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          className="notification-panel"
          id="seller-notification-panel"
          aria-label="Thông báo"
        >
          <header className="notification-panel-header">
            <div>
              <h2>Thông báo</h2>
              <p>
                {unreadCount > 0
                  ? `${unreadCount} thông báo chưa đọc`
                  : "Bạn đã xem hết thông báo"}
              </p>
            </div>
            <button
              type="button"
              className="notification-read-all"
              onClick={markAllRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck size={15} />
              Đánh dấu đã đọc
            </button>
          </header>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">
                <Bell size={22} />
                <strong>Chưa có thông báo</strong>
                <span>Đơn hàng mới và cảnh báo tồn kho sẽ hiện ở đây.</span>
              </div>
            ) : (
              notifications.map((notification) => {
                const Icon =
                  notification.kind === "order" ? ShoppingBag : AlertTriangle;
                const isUnread = !readIds.has(notification.id);
                return (
                  <button
                    type="button"
                    className={`notification-item${isUnread ? " is-unread" : ""}`}
                    key={notification.id}
                    onClick={() => openNotification(notification)}
                  >
                    <span
                      className={`notification-item-icon notification-item-icon--${notification.kind}`}
                    >
                      <Icon size={17} />
                    </span>
                    <span className="notification-item-content">
                      <strong>{notification.title}</strong>
                      <span>{notification.message}</span>
                      <time>
                        {formatNotificationTime(notification)}
                      </time>
                    </span>
                    {isUnread && (
                      <span
                        className="notification-unread-dot"
                        aria-label="Chưa đọc"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
          <footer className="notification-panel-footer">
            Cập nhật dữ liệu tự động mỗi phút
          </footer>
        </section>
      )}
    </div>
  );
}
