const CACHE = "sissy-random-v5";
const ASSETS = [
  "./styles.css?v=5",
  "./app.js?v=5",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./maskable-icon.png",
  "./apple-touch-icon.png"
];

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;

  // Always try network first for page navigations so F5 gets fresh HTML.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(resp => {
          const copy = resp.clone();
          caches.open(CACHE).then(cache => cache.put("./", copy));
          return resp;
        })
        .catch(() => caches.match("./").then(cached => cached || caches.match("./index.html")))
    );
    return;
  }

  // Cache-first for static versioned assets.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy));
        return resp;
      });
    })
  );
});
