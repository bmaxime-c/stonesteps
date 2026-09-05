import type { PlannedLevel, SetOutcome } from './progress'

/**
 * Persistance locale de la seance en cours.
 *
 * IndexedDB et non localStorage : la seance survit ainsi a un rechargement, a
 * une mise en veille, et surtout a l'absence de reseau. C'est la seule source
 * de verite pendant l'effort ; le serveur n'est rejoint qu'a la
 * synchronisation.
 *
 * Ecrit directement en IndexedDB, sans bibliotheque : un seul magasin, deux
 * operations, ce n'est pas la peine d'embarquer une dependance.
 */

const DB_NAME = 'stonesteps'
const DB_VERSION = 1
const STORE = 'sessions'

export interface LocalSession {
  id: string
  gridId: string
  gridName: string
  level: PlannedLevel
  startedAt: string
  endedAt: string | null
  outcomes: SetOutcome[]
  /** Passe a vrai une fois la seance poussee au serveur sans erreur. */
  synced: boolean
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function run<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        const request = operation(transaction.objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
        transaction.oncomplete = () => db.close()
      }),
  )
}

export async function saveLocalSession(session: LocalSession): Promise<void> {
  await run('readwrite', (store) => store.put(session))
}

export async function loadLocalSession(id: string): Promise<LocalSession | undefined> {
  return run<LocalSession | undefined>('readonly', (store) => store.get(id))
}

export async function listLocalSessions(): Promise<LocalSession[]> {
  const all = await run<LocalSession[]>('readonly', (store) => store.getAll())
  return all ?? []
}

/** Seances restees en local faute de reseau, les plus anciennes d'abord. */
export async function listPendingSessions(): Promise<LocalSession[]> {
  const all = await listLocalSessions()
  return all
    .filter((session) => !session.synced)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
}

/** Seance en cours : commencee, pas encore terminee. */
export async function findUnfinishedSession(): Promise<LocalSession | undefined> {
  const all = await listLocalSessions()
  return all
    .filter((session) => session.endedAt === null)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
}

export async function deleteLocalSession(id: string): Promise<void> {
  await run('readwrite', (store) => store.delete(id))
}

/**
 * Vide le magasin. Appele a la deconnexion : les seances d'un compte n'ont
 * rien a faire sur l'appareil une fois celui-ci quitte.
 */
export async function clearLocalSessions(): Promise<void> {
  await run('readwrite', (store) => store.clear())
}

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}
