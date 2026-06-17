/* Service worker — network-first לקבצי האפליקציה בלבד.
   קבצי הורדה (templates/) ובקשות שאינן GET עוברים ישירות לדפדפן, כדי שלא להפריע להורדות. */
var CACHE = "ibca-cert-v2";

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
  var url;
  try { url = new URL(e.request.url); } catch (err) { return; }
  // אל תיגע בהורדות (templates/) או בבקשות שאינן GET — שהדפדפן יטפל בהן רגיל
  if (e.request.method !== "GET" || url.pathname.indexOf("/templates/") !== -1) return;
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
