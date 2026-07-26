// Linage service worker v3.
// Strategy:
//   - Navigations (index.html): NETWORK-FIRST, cache fallback for offline.
//     This guarantees a fresh app shell after every deploy — the v1
//     cache-first shell served stale HTML pointing at purged assets.
//   - Same-origin assets: cache-first (Vite content-hashes filenames,
//     so a cached asset can never be stale).
//   - /api/* is NEVER touched (v3): the CORS proxy is dynamic — caching
//     it would serve stale model lists and completions forever.
const CACHE = 'linage-v3'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./']).catch(() => {})))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  // API calls are dynamic — let them hit the network untouched.
  if (url.pathname.startsWith('/api/')) return

  // App shell: network-first so deploys are picked up immediately.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put('./', copy))
          }
          return res
        })
        .catch(() => caches.match('./').then((hit) => hit || caches.match(e.request))),
    )
    return
  }

  // Hashed assets: cache-first.
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(e.request, copy))
          }
          return res
        }),
    ),
  )
})
