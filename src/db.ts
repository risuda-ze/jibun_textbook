import { Textbook, TextbookSchema } from './types'

const DB_NAME = 'jibun_textbook'
const STORE_NAME = 'textbooks'

let db: IDBDatabase

export async function initDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve()
    }

    request.onupgradeneeded = (e) => {
      const database = (e.target as IDBOpenDBRequest).result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

export async function saveTextbook(textbook: Textbook): Promise<void> {
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readwrite')
    const store = txn.objectStore(STORE_NAME)
    const request = store.put(textbook)

    request.onerror = () => reject(request.error)
    txn.oncomplete = () => resolve()
  })
}

export async function getTextbook(id: string): Promise<Textbook | null> {
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readonly')
    const store = txn.objectStore(STORE_NAME)
    const request = store.get(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const result = request.result
      if (result) {
        try {
          const validated = TextbookSchema.parse(result)
          resolve(validated)
        } catch (e) {
          reject(new Error('Invalid textbook schema'))
        }
      } else {
        resolve(null)
      }
    }
  })
}

export async function listTextbooks(): Promise<Textbook[]> {
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readonly')
    const store = txn.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      try {
        const results = request.result.map(item => TextbookSchema.parse(item))
        resolve(results.sort((a, b) => b.updatedAt - a.updatedAt))
      } catch (e) {
        reject(new Error('Invalid textbook in store'))
      }
    }
  })
}

export async function deleteTextbook(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readwrite')
    const store = txn.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onerror = () => reject(request.error)
    txn.oncomplete = () => resolve()
  })
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    return navigator.storage.persist()
  }
  return false
}
