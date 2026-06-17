/* Service worker — network-first כדי שאף קובץ לא יישאר ישן (cache רק כגיבוי לאופליין). */
var CACHE = "ibca-cert-v1";

self.addEventListener("install", function (e) {
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(function (resp) {
      try {
        var copy = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      } catch (err) {}
      return resp;
    }).catch(function () {
      return caches.match(e.request);
    })
  );
});
