/* Service worker de Typo: cachea los archivos para que la app abra offline
   y sea instalable. Network-first: online siempre trae lo último (updates),
   offline cae al caché. */
const CACHE = "typo-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./game.js",
  "./engine.js",
  "./pcbfx.js",
  "./themes.js",
  "./words_es.js",
  "./pcb-bg.png",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  // Network-first: intenta red (fresco), cachea, y si no hay red usa el caché.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && new URL(req.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
