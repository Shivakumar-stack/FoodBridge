const CACHE_NAME = "foodbridge-demo-v2-alignment-fix";
const STATIC_ASSETS = [
  "/",
  "/pages/index.html",
  "/pages/donate.html",
  "/pages/login.html",
  "/pages/dashboard-unified.html",
  "/styles/main.css",
  "/styles/dashboard.css",
  "/styles/auth.css",
  "/utils/config.js",
  "/utils/app.js",
  "/utils/auth-guard.js",
  "/utils/donate.js",
  "/assets/images/logo.png",
  "/assets/images/donate-hero-bg.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.ok && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    }),
  );
});
