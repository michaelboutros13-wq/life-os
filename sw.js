/*
 * LIFE OS service worker — lets the installed app open instantly and show the last
 * loaded screen when the phone is offline.
 *
 * Only the app's own files (HTML, JS, CSS, icons) are cached. Anything that talks to
 * your account (Supabase, Google) goes straight to the network and is never stored,
 * so no personal data is kept by the service worker.
 */
const CACHE = 'lifeos-shell-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase, Google, fonts: network only

  // Network first so a new release is picked up immediately; fall back to the cache offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (res.type === 'basic' || res.type === 'default')) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
        }
        return res
      })
      .catch(async () => {
        const hit = await caches.match(req)
        if (hit) return hit
        // Offline deep link (e.g. /goals/…): serve the app shell, the router takes it from there.
        if (req.mode === 'navigate') {
          const shell = (await caches.match(self.registration.scope)) || (await caches.match(new URL('./index.html', self.registration.scope).href))
          if (shell) return shell
        }
        return Response.error()
      }),
  )
})
