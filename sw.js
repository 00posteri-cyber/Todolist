const CACHE_NAME = "focusdog-v13";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=13",
  "./app.js?v=13",
  "./manifest.webmanifest",
  "./assets/app-icon.svg",
  "./assets/focus-dashboard-bg.png",
  "./assets/dog-mascot.png?v=2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
