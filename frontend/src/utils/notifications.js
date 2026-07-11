// Zoomify — Notification utilities
// Handles service worker registration, permission requests, and local notifications.

/**
 * Register the service worker and request notification permission.
 * Call this once on app load (e.g. in ChatHome's useEffect).
 */
export async function initNotifications() {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

  // Register service worker
  try {
    await navigator.serviceWorker.register("/service-worker.js");
  } catch (e) {
    console.warn("[SW] Registration failed:", e);
  }

  // Request permission if not already granted
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

/**
 * Show a local browser notification (no server-side push needed).
 * Works immediately once permission is granted.
 */
export function showLocalNotification(title, body, options = {}) {
  if (Notification.permission !== "granted") return;

  const tag = options.tag || "zoomify-" + Date.now();

  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        body,
        icon: "/logo192.png",
        badge: "/logo192.png",
        vibrate: [200, 100, 200],
        tag,
        renotify: true,
        data: { url: options.url || "/" },
        ...options,
      });
    });
  } else {
    // Fallback to plain Notification API
    new Notification(title, { body, icon: "/logo192.png", tag });
  }
}
