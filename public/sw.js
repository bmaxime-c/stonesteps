/*
 * Service worker StoneSteps.
 *
 * Deux comportements distincts, selon ce qui est demande :
 *
 *  - la route /seance est mise en cache apres chaque visite reussie. Recharger
 *    son telephone au milieu d'une serie, sans reseau, ne doit pas faire
 *    perdre la seance — les resultats sont en IndexedDB, encore faut-il que la
 *    page se reaffiche pour les relire.
 *  - toute autre navigation retombe sur la page hors ligne.
 *
 * Les requetes vers Supabase ne sont jamais interceptees : une reponse d'API
 * perimee serait pire que pas de reponse du tout.
 *
 * Le cache de /seance contient du HTML authentifie. Il est cantonne a
 * l'origine de l'application et a l'appareil, et la deconnexion le vide via le
 * message CLEAR_CACHES.
 */

const CACHE = 'stonesteps-shell-v2'
const OFFLINE_URL = '/offline'
const SESSION_URL = '/seance'
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

  const isSession = url.pathname === SESSION_URL

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (isSession && response.ok) {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put(SESSION_URL, copy))
        }
        return response
      })
      .catch(async () => {
        const cache = await caches.open(CACHE)
        if (isSession) {
          const cached = await cache.match(SESSION_URL)
          if (cached) return cached
        }
        return (await cache.match(OFFLINE_URL)) ?? Response.error()
      }),
  )
})
