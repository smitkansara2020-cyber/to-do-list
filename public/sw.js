/**
 * Pinboard Progressive Web App Service Worker
 * Handles static asset caching, offline page support, and push notifications.
 * Strictly avoids caching sensitive per-user API responses to prevent cross-account leaks.
 */

const CACHE_NAME = "pinboard-static-v1";
const STATIC_ASSETS = [
  "/",
  "/favicon.ico",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/robots.txt",
];

// Install Event: Pre-cache core shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }),
  );
  self.skipWaiting();
});

// Activate Event: Cleanup stale caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      );
    }),
  );
  self.clients.claim();
});

// Fetch Event: Stale-while-revalidate for static assets, network-only for Supabase / Auth APIs
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // NEVER cache Supabase API calls or auth tokens to avoid cross-user data leakage
  if (url.hostname.includes("supabase") || url.pathname.startsWith("/rest/") || url.pathname.startsWith("/auth/")) {
    return;
  }

  // Network-first navigation with offline fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match("/");
        return cached || new Response("You are offline. Pinboard will sync when connection returns.", {
          headers: { "Content-Type": "text/plain" },
        });
      }),
    );
    return;
  }

  // Cache static assets (images, fonts, scripts)
  if (
    url.pathname.match(/\.(js|css|svg|png|jpg|jpeg|woff2?|ico)$/) ||
    STATIC_ASSETS.includes(url.pathname)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        });
      }),
    );
  }
});

// Push Notification Listener
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || "Pinboard Reminder 📌";
    const options = {
      body: data.body || "You have an upcoming scheduled task.",
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      data: { url: data.url || "/today" },
      actions: [
        { action: "open", title: "Open Planner" },
        { action: "snooze", title: "Snooze 10m" },
      ],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("Push notification parse error", err);
  }
});

// Notification Click Listener
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/today";

  if (event.action === "snooze") {
    // Handled by local snooze queue
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});
