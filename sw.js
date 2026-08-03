const CACHE = 'myfinance-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async c => {
      await Promise.all(ASSETS.map(async url => {
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (res.ok) await c.put(url, res);
          else console.warn('SW: skipped (not ok)', url, res.status);
        } catch (err) {
          console.warn('SW: could not cache', url, err);
        }
      }));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (!e.request.url.startsWith(self.location.origin) &&
      !e.request.url.includes('fonts.googleapis.com') &&
      !e.request.url.includes('fonts.gstatic.com')) return;

  const isPage = e.request.mode === 'navigate' ||
                 e.request.url.endsWith('/') ||
                 e.request.url.endsWith('index.html');

  if (isPage) {
    // NETWORK-FIRST for the app shell itself, so code updates show up
    // immediately whenever the phone is online — no manual cache-clearing needed.
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).then(res => {
        caches.open(CACHE).then(c => { c.put('./', res.clone()); c.put('./index.html', res.clone()); });
        return res;
      }).catch(async () => {
        return (await caches.match('./')) || (await caches.match('./index.html'));
      })
    );
    return;
  }

  // CACHE-FIRST for everything else (icons, manifest, fonts) — these change
  // rarely, so serving from cache instantly is fine.
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (e.request.url.includes('fonts.')) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {});
    })
  );
});
