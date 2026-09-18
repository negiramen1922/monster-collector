/* ホーム画面に置いたときのためのサービスワーカー。

   index.html はネットワーク優先(公開し直したら次の起動で新しい方になる)、
   画像・音・アイコンはキャッシュ優先。Firebaseなど別ドメインには触らない。 */
const CACHE = 'monster-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest',
               './assets/favicon.png', './assets/icon-192.png', './assets/icon-512.png'];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;     // Firebase・フォントなどは素通し

  // the page itself: take the fresh one when the network answers
  if(req.mode === 'navigate' || url.pathname.endsWith('/index.html')){
    ev.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  // everything else (BGM, icons): from the cache, and keep a copy the first time
  ev.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if(res.ok && res.type === 'basic'){
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }))
  );
});
