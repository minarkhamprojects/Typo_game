/* Service worker de Typo: la app abre offline y es instalable.
   Estrategia híbrida:
   - Diccionario (words_es.txt ~6.75 MB) e imágenes (.webp/.png/.jpg): CACHE-FIRST.
     Son inmutables; una vez en caché nunca se vuelven a descargar (antes eran
     network-first y se re-bajaban en cada apertura con señal — el gran costo).
   - HTML/CSS/JS: NETWORK-FIRST, para seguir recibiendo actualizaciones (los
     assets versionados con ?v= igual entran frescos por URL distinta). */
const CACHE = "typo-v3";
// Shell mínimo (archivos chicos). El diccionario NO se precachea: se guarda solo
// cuando el juego lo pide (evita descargarlo dos veces la primera sesión).
const SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./game.js",
  "./engine.js",
  "./pcbfx.js",
  "./themes.js",
  "./trivia.js",
  "./skins.js",
  "./skins.css",
  "./multiplayer.js",
  "./manifest.json",
];

// Rutas que sirven cache-first (inmutables y pesadas).
function isImmutable(url) {
  return /words_es\.txt$|\.webp$|\.png$|\.jpe?g$/i.test(url);
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
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
  const sameOrigin = new URL(req.url).origin === location.origin;

  // Cache-first para el diccionario e imágenes: si ya está, no toca la red.
  if (sameOrigin && isImmutable(req.url)) {
    e.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  // Network-first para el resto (trae lo último; offline cae al caché).
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && sameOrigin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
