// Service worker: caches the arcade and every game on install so it all works offline.
// Written by tools/sync.mjs from tools/sw.template.js — edit the template, not sw.js.
const VERSION = '__VERSION__';
const CACHE = `arcade-${VERSION}`;
const FILES = ['__FILES__'];

self.addEventListener('install', (e) => {
  // cache: 'reload': straight from the server, not the browser's HTTP cache
  // (GitHub Pages lets that keep files 10 minutes, which would put the old
  // version's files in the new version's cache)
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('arcade-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// cache first, falling back to the network (and caching what it returns)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok && new URL(e.request.url).origin === location.origin) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
    }
    return res;
  })));
});
