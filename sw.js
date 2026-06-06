const CACHE_NAME = "focusdog-v25";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=22",
  "./app.js?v=25",
  "./manifest.webmanifest",
  "./assets/app-icon.svg",
  "./assets/focus-dashboard-bg.png",
  "./assets/mascot/dog_happy.png?v=4",
  "./assets/mascot/dog_focus.png?v=4",
  "./assets/mascot/dog_sleep.png?v=4",
  "./assets/mascot/dog_celebrate.png?v=4",
  "./assets/mascot/dog_money.png?v=4",
  "./assets/mascot/dog_empty.png?v=4",
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
