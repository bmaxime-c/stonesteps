/*
 * Service worker StoneSteps.
 *
 * Il ne met en cache que la coquille applicative : la page hors ligne et le
 * manifeste. Toute navigation qui echoue faute de reseau retombe sur la page
 * hors ligne.
 *
 * Les requetes vers Supabase ne sont jamais interceptees : une reponse d'API
 * perimee serait pire que pas de reponse du tout. Aucun HTML authentifie n'est
 * conserve, ce qui evite qu'une page reste lisible apres une deconnexion.
 */

const CACHE = 'stonesteps-shell-v3'
const OFFLINE_URL = '/offline'
const PRECACHE = [OFFLINE_URL, '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
    )
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return
  if (request.mode !== 'navigate') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE)
      return (await cache.match(OFFLINE_URL)) ?? Response.error()
    }),
  )
})
