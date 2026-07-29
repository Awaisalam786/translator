import { get, set, del } from 'idb-keyval'
import { logMobileDebug } from '../components/DebugOverlay'

// Storage modes
const STORAGE_MODES = {
  INDEXED_DB: 'IndexedDB',
  CHUNKED_LOCAL: 'Chunked localStorage',
  IN_MEMORY: 'In-Memory (Session Only)'
}

let activeStorageMode = STORAGE_MODES.INDEXED_DB
const inMemoryStore = new Map()

// Check & request persistent storage on startup
export async function initStorage() {
  if (navigator.storage && navigator.storage.persist) {
    try {
      await navigator.storage.persist()
    } catch (e) {
      console.warn('[Storage] Persistence request error:', e)
    }
  }
}

// ── Binary & Large Blob Storage (IndexedDB -> Chunked -> Memory) ──────────────

export async function saveLargeData(key, data) {
  // 1. Try IndexedDB
  try {
    await set(key, data)
    activeStorageMode = STORAGE_MODES.INDEXED_DB
    logMobileDebug(`[Storage] Saved ${key} to IndexedDB successfully!`)
    return true
  } catch (err) {
    logMobileDebug(`⚠️ [Storage] IndexedDB save failed: ${err.message}. Trying Chunked localStorage...`)
  }

  // 2. Fallback: Chunked localStorage
  try {
    let base64String = ''
    if (data instanceof ArrayBuffer) {
      base64String = arrayBufferToBase64(data)
    } else if (typeof data === 'string') {
      base64String = data
    } else {
      base64String = JSON.stringify(data)
    }

    const chunkSize = 2.5 * 1024 * 1024 // ~2.5MB chunks
    const totalChunks = Math.ceil(base64String.length / chunkSize)

    // Clear any previous chunks for this key
    clearChunkedLocalStorage(key)

    for (let i = 0; i < totalChunks; i++) {
      const chunk = base64String.slice(i * chunkSize, (i + 1) * chunkSize)
      localStorage.setItem(`${key}_chunk_${i}`, chunk)
    }
    localStorage.setItem(`${key}_chunk_meta`, JSON.stringify({ totalChunks, isBase64: data instanceof ArrayBuffer }))

    activeStorageMode = STORAGE_MODES.CHUNKED_LOCAL
    logMobileDebug(`[Storage] Saved ${key} to Chunked localStorage successfully!`)
    return true
  } catch (err) {
    logMobileDebug(`⚠️ [Storage] Chunked localStorage failed: ${err.message}. Falling back to In-Memory store...`)
  }

  // 3. Fallback: In-Memory
  inMemoryStore.set(key, data)
  activeStorageMode = STORAGE_MODES.IN_MEMORY
  logMobileDebug(`[Storage] Saved ${key} to In-Memory store!`)
  return true
}

export async function getLargeData(key) {
  logMobileDebug(`[Storage] Reading ${key}...`)
  // 1. Check IndexedDB
  try {
    const val = await get(key)
    if (val !== undefined && val !== null) {
      logMobileDebug(`[Storage] Read ${key} from IndexedDB successfully!`)
      return val
    }
  } catch (err) {
    logMobileDebug(`⚠️ [Storage] IndexedDB read error: ${err.message}`)
  }

  // 2. Check Chunked localStorage
  try {
    const metaStr = localStorage.getItem(`${key}_chunk_meta`)
    if (metaStr) {
      const { totalChunks, isBase64 } = JSON.parse(metaStr)
      let fullStr = ''
      for (let i = 0; i < totalChunks; i++) {
        const chunk = localStorage.getItem(`${key}_chunk_${i}`)
        if (chunk) fullStr += chunk
      }
      if (isBase64) {
        return base64ToArrayBuffer(fullStr)
      }
      try {
        return JSON.parse(fullStr)
      } catch {
        return fullStr
      }
    }
  } catch (err) {
    console.warn('[Storage] Chunked localStorage read error:', err)
  }

  // 3. Check In-Memory
  if (inMemoryStore.has(key)) {
    return inMemoryStore.get(key)
  }

  return null
}

export async function deleteLargeData(key) {
  try {
    await del(key)
  } catch (e) {}
  clearChunkedLocalStorage(key)
  inMemoryStore.delete(key)
}

function clearChunkedLocalStorage(key) {
  try {
    const metaStr = localStorage.getItem(`${key}_chunk_meta`)
    if (metaStr) {
      const { totalChunks } = JSON.parse(metaStr)
      for (let i = 0; i < totalChunks; i++) {
        localStorage.removeItem(`${key}_chunk_${i}`)
      }
      localStorage.removeItem(`${key}_chunk_meta`)
    }
  } catch (e) {}
}

export async function getBookStorageSize(bookId) {
  try {
    const data = await getLargeData(`book_blob_${bookId}`)
    if (!data) return 0
    if (data instanceof ArrayBuffer) {
      return data.byteLength
    }
    if (typeof data === 'string') {
      return data.length
    }
    return JSON.stringify(data).length
  } catch (e) {
    return 0
  }
}

// ── Small Metadata Storage (localStorage directly) ────────────────────────────

const BOOKS_KEY = 'leselampe_books'

export function getBooksMetadata() {
  try {
    const stored = localStorage.getItem(BOOKS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (e) {
    console.error('[Storage] Reading books metadata error:', e)
    return []
  }
}

export function saveBooksMetadata(books) {
  try {
    localStorage.setItem(BOOKS_KEY, JSON.stringify(books))
  } catch (e) {
    console.error('[Storage] Saving books metadata error:', e)
  }
}

export async function deleteBookComplete(bookId) {
  // 1. Delete metadata
  const books = getBooksMetadata()
  const updated = books.filter(b => b.id !== bookId)
  saveBooksMetadata(updated)

  // 2. Delete main blob
  await deleteLargeData(`book_blob_${bookId}`)

  // 3. Delete OCR caches for all pages of this book
  try {
    // Clean up any keys starting with ocr_cache_${bookId}_
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(`ocr_cache_${bookId}_`)) {
        localStorage.removeItem(key)
      }
    }
  } catch (e) {}
}

// ── Storage Estimates & Status Line ──────────────────────────────────────────

export async function getStorageStatus() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate()
      const usedMB = (estimate.usage / (1024 * 1024)).toFixed(1)
      const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(0)
      const pctUsed = Math.round((estimate.usage / estimate.quota) * 100)

      let message = `${usedMB} MB used of ~${quotaMB} MB available — plenty of room for more books`
      let isWarning = false

      if (pctUsed > 85) {
        message = `Storage getting full (${usedMB} MB / ${quotaMB} MB) — consider removing older books`
        isWarning = true
      }

      return {
        mode: activeStorageMode,
        usedMB,
        quotaMB,
        pctUsed,
        message,
        isWarning
      }
    } catch (e) {}
  }

  // Fallback estimate
  return {
    mode: activeStorageMode,
    usedMB: '5.0',
    quotaMB: '500',
    pctUsed: 1,
    message: `Storage active (${activeStorageMode})`,
    isWarning: activeStorageMode === STORAGE_MODES.IN_MEMORY
  }
}

// ── Helper Utilities ──────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}
