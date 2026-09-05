/*
 * Service worker StoneSteps - phase 1 : coquille applicative uniquement.
 *
 * Strategie network-first pour les navigations : on sert toujours la version
 * en ligne quand le reseau repond, et on retombe sur la page hors ligne mise
 * en cache sinon. Les requetes vers Supabase ne sont jamais interceptees :
 * une reponse d'API perimee serait pire que pas de reponse du tout.
 *
 * La mise en cache des donnees de seance arrive en phase 3.
 */

const CACHE = 'stonesteps-shell-v1'
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

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return
  if (request.mode !== 'navigate') return

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE)
      return (await cache.match(OFFLINE_URL)) ?? Response.error()
    }),
  )
})
