// FamilyVault service worker — offline app shell + asset caching
const CACHE = 'familyvault-v8';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './favicon.png'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function(){}); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return; // never cache writes

  var url = new URL(req.url);

  // Never cache the app's backend API (Apps Script) — always go to network.
  if (url.hostname.indexOf('script.google.com') >= 0 || url.hostname.indexOf('googleusercontent.com') >= 0) {
    return; // default network handling
  }

  // Navigations: network first, fall back to cached shell (offline launch).
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(function () { return caches.match('./index.html'); })
    );
    return;
  }

  // Same-origin assets + CDN libraries/fonts: cache-first, then network (and cache it).
  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (resp) {
        try {
          if (resp && (resp.ok || resp.type === 'opaque')) {
            var copy = resp.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copy); });
          }
        } catch (err) {}
        return resp;
      }).catch(function () { return cached; });
    })
  );
});
