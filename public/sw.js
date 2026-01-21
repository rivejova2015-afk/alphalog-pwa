// Service Worker for AlphaLog PWA
const CACHE_VERSION = "v6a-2";
const CACHE_NAME = `alphalog-${CACHE_VERSION}`;

// Precache on install
const PRECACHE_URLS = [
  "/offline",
  "/dashboard",
  "/manifest.webmanifest",
];

// Routes to completely exclude from caching
const CACHE_BLOCKLIST = [
  "/auth",
  "/auth/callback",
  "/api/auth",
];

self.addEventListener("install", (event) => {
  console.log("[SW] Installing", CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Precaching URLs");
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Precache failures are non-blocking
        console.warn("[SW] Some precache URLs failed");
      });
    })
  );
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activating", CACHE_NAME);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME && name.startsWith("alphalog-")) {
            console.log("[SW] Deleting old cache:", name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip caching for auth routes, callbacks, and OAuth parameters
  if (
    CACHE_BLOCKLIST.some((path) => url.pathname.startsWith(path)) ||
    url.search.includes("code=") ||
    url.search.includes("state=")
  ) {
    // Explicit network-only for auth-related requests
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  // Navigation requests (HTML pages)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, response.clone());
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            // Fallback to offline page
            return caches.match("/offline").catch(() => {
              return new Response("Offline", { status: 503 });
            });
          });
        })
    );
    return;
  }

  // API GET requests (network-first with cache fallback)
  if (request.method === "GET" && url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, response.clone());
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).catch(() => {
            return new Response(JSON.stringify({ error: "Offline" }), {
              status: 503,
              headers: { "Content-Type": "application/json" },
            });
          });
        })
    );
    return;
  }

  // Static assets (cache-first)
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, response.clone());
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Default: network-first
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200 && request.method === "GET") {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, response.clone());
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).catch(() => {
          return new Response("Network error", { status: 503 });
        });
      })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});