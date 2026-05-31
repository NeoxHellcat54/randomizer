const CACHE = "sissy-random-v2";
const FILES = ["./","./index.html","./styles.css","./app.js","./manifest.json"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", event => {
  event.respondWith(caches.match(event.request).then(resp => resp || fetch(event.request)));
});
