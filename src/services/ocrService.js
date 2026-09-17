import { createWorker, PSM } from 'tesseract.js'
import { get, set } from 'idb-keyval'
import { logMobileDebug } from '../components/DebugOverlay'

// Local origin path for instant offline traineddata loading from public/
const getLangPath = () => {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin
  }
  return './public'
}

let tapWorkerInstance = null
let tapWorkerPromise = null
let pageWorkerInstance = null
let pageWorkerPromise = null

/**
 * Robust helper to extract word objects from Tesseract.js v7 results
 * In v7, words are located inside blocks -> paragraphs -> lines -> words
 */
export function extractWordsFromTesseractResult(result) {
  const words = []

  // Case 1: result.data.words if present
  if (Array.isArray(result?.data?.words) && result.data.words.length > 0) {
    return result.data.words
  }

  // Case 2: Tesseract v7 hierarchical blocks
  const blocks = result?.data?.blocks || []
  for (const block of blocks) {
    for (const para of (block.paragraphs || [])) {
      for (const line of (para.lines || [])) {
        for (const word of (line.words || [])) {
          if (word && word.text) {
            words.push(word)
          }
        }
      }
    }
  }

  // Case 3: Fallback from raw text string if blocks were empty
  if (words.length === 0 && result?.data?.text) {
    const rawTokens = result.data.text.trim().split(/\s+/)
    for (const t of rawTokens) {
      const clean = t.replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '').trim()
      if (clean && clean.length > 0) {
        words.push({
          text: clean,
          bbox: { x0: 0, y0: 0, x1: 80, y1: 30 }
        })
      }
    }
  }

  return words
}

export function normalizeOcrLang(lang) {
  if (!lang) return 'deu'
  const l = String(lang).toLowerCase().trim()
  if (l === 'de' || l === 'deu' || l === 'german') return 'deu'
  if (l === 'en' || l === 'eng' || l === 'english') return 'eng'
  if (l === 'es' || l === 'spa' || l === 'spanish') return 'spa'
  if (l === 'fr' || l === 'fra' || l === 'french') return 'fra'
  if (l === 'it' || l === 'ita' || l === 'italian') return 'ita'
  return l
}

/**
 * Dedicated lightweight worker for Instant Tap OCR
 */
export async function getTapWorker(lang = 'deu') {
  const targetLang = normalizeOcrLang(lang)
  if (tapWorkerInstance) return tapWorkerInstance
  if (tapWorkerPromise) return tapWorkerPromise

  tapWorkerPromise = (async () => {
    try {
      const worker = await createWorker(targetLang, 1, {
        langPath: getLangPath(),
        gzip: false
      })
      tapWorkerInstance = worker
      logMobileDebug(`[OcrService] ⚡ Local Instant Tap OCR worker ready (${targetLang})!`)
      return tapWorkerInstance
    } catch (e1) {
      logMobileDebug(`⚠️ [OcrService] Tap worker ${targetLang} notice: ${e1.message}. Trying eng...`)
      try {
        const worker = await createWorker('eng', 1, {
          langPath: getLangPath(),
          gzip: false
        })
        tapWorkerInstance = worker
        return tapWorkerInstance
      } catch (e2) {
        logMobileDebug(`❌ [OcrService] Tap worker init error: ${e2.message}`)
        tapWorkerInstance = null
        return null
      }
    } finally {
      tapWorkerPromise = null
    }
  })()

  return tapWorkerPromise
}

/**
 * Background worker for full page recognition
 */
export async function getPageWorker(lang = 'deu') {
  const targetLang = normalizeOcrLang(lang)
  if (pageWorkerInstance) return pageWorkerInstance
  if (pageWorkerPromise) return pageWorkerPromise

  pageWorkerPromise = (async () => {
    try {
      const worker = await createWorker(targetLang, 1, {
        langPath: getLangPath(),
        gzip: false
      })
      pageWorkerInstance = worker
      logMobileDebug(`[OcrService] ✅ Local Page OCR worker ready (${targetLang})!`)
      return pageWorkerInstance
    } catch (e1) {
      logMobileDebug(`⚠️ [OcrService] Page worker ${targetLang} notice: ${e1.message}. Trying eng...`)
      try {
        const worker = await createWorker('eng', 1, {
          langPath: getLangPath(),
          gzip: false
        })
        pageWorkerInstance = worker
        return pageWorkerInstance
      } catch (e2) {
        logMobileDebug(`❌ [OcrService] Page worker init error: ${e2.message}`)
        pageWorkerInstance = null
        return null
      }
    } finally {
      pageWorkerPromise = null
    }
  })()

  return pageWorkerPromise
}

/**
 * Recognize an entire canvas page with Normalized Coordinates & IndexedDB caching.
 * Normalized coordinates ensure 100% alignment across any zoom scale and devicePixelRatio.
 */
export async function recognizePageWithCache(bookId, pageNum, canvas, dpr = 1, lang = 'deu') {
  if (!canvas || canvas.width === 0 || canvas.height === 0) return []

  const targetLang = normalizeOcrLang(lang)
  const cacheKey = `ocr_tokens_${bookId || 'pdf'}_p${pageNum}`
  const cssWidth = Math.floor(canvas.width / dpr)
  const cssHeight = Math.floor(canvas.height / dpr)

  // 1. Check IndexedDB cache for instant 0ms retrieval
  try {
    const cachedTokens = await get(cacheKey)
    if (Array.isArray(cachedTokens) && cachedTokens.length > 0) {
      logMobileDebug(`[OcrService] ⚡ Loaded ${cachedTokens.length} OCR tokens from IndexedDB cache for Page ${pageNum}`)
      // Rescale normalized coordinates to current CSS size
      return cachedTokens.map(t => {
        const x = t.normX != null ? Math.round(t.normX * cssWidth) : t.x
        const y = t.normY != null ? Math.round(t.normY * cssHeight) : t.y
        const w = t.normW != null ? Math.max(12, Math.round(t.normW * cssWidth)) : t.w
        const h = t.normH != null ? Math.max(12, Math.round(t.normH * cssHeight)) : t.h
        return {
          ...t,
          x,
          y,
          w,
          h,
          cx: x + w / 2,
          cy: y + h / 2
        }
      })
    }
  } catch (e) {}

  // 2. Perform OCR recognition on canvas using local pageWorker
  const worker = await getPageWorker(targetLang)
  if (!worker) return []

  try {
    // For fast OCR without stalling on ultra-high-resolution canvases, limit max dimension to 1400px
    let ocrInput = canvas
    let ocrW = canvas.width
    let ocrH = canvas.height

    const maxDim = 1400
    if (canvas.width > maxDim || canvas.height > maxDim) {
      const scale = Math.min(maxDim / canvas.width, maxDim / canvas.height)
      ocrW = Math.round(canvas.width * scale)
      ocrH = Math.round(canvas.height * scale)
      const scaleCanvas = document.createElement('canvas')
      scaleCanvas.width = ocrW
      scaleCanvas.height = ocrH
      const sCtx = scaleCanvas.getContext('2d')
      sCtx.drawImage(canvas, 0, 0, ocrW, ocrH)
      ocrInput = scaleCanvas
    }

    const result = await worker.recognize(ocrInput, {}, { blocks: true })
    const rawWords = extractWordsFromTesseractResult(result)
    const tokens = []

    for (const w of rawWords) {
      const rawText = (w.text || '').trim()
      const clean = rawText.replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '').trim()
      if (!clean || clean.length < 1) continue

      const bbox = w.bbox || { x0: 0, y0: 0, x1: 50, y1: 20 }
      const normX = bbox.x0 / ocrW
      const normY = bbox.y0 / ocrH
      const normW = Math.max(0.005, (bbox.x1 - bbox.x0) / ocrW)
      const normH = Math.max(0.005, (bbox.y1 - bbox.y0) / ocrH)

      const wordX = Math.round(normX * cssWidth)
      const wordY = Math.round(normY * cssHeight)
      const wordW = Math.max(12, Math.round(normW * cssWidth))
      const wordH = Math.max(12, Math.round(normH * cssHeight))

      tokens.push({
        word: clean,
        normX,
        normY,
        normW,
        normH,
        x: wordX,
        y: wordY,
        w: wordW,
        h: wordH,
        cx: wordX + wordW / 2,
        cy: wordY + wordH / 2
      })
    }

    logMobileDebug(`[OcrService] ✅ Full-page OCR extracted ${tokens.length} tokens for Page ${pageNum}`)

    // 3. Save normalized tokens to IndexedDB cache
    if (tokens.length > 0) {
      try {
        await set(cacheKey, tokens)
      } catch (e) {}
    }

    return tokens
  } catch (err) {
    logMobileDebug(`❌ [OcrService] Full-page OCR notice on Page ${pageNum}: ${err.message}`)
    return []
  }
}

/**
 * Instant On-Demand Tap-to-OCR: Crops a region around the user's tap point
 * and recognizes the word in ~100ms using dedicated tapWorker with blocks output.
 */
export async function recognizeTapCrop(canvas, domX, domY, dpr = 1, lang = 'deu') {
  if (!canvas || canvas.width === 0 || canvas.height === 0) return null

  const targetLang = normalizeOcrLang(lang)
  const worker = await getTapWorker(targetLang)
  if (!worker) return null

  try {
    const canvasX = domX * dpr
    const canvasY = domY * dpr

    // Crop a 300x100 region centered at tap coordinates
    const cropW = Math.min(300 * dpr, canvas.width)
    const cropH = Math.min(100 * dpr, canvas.height)
    const cropX = Math.max(0, Math.min(canvas.width - cropW, canvasX - cropW / 2))
    const cropY = Math.max(0, Math.min(canvas.height - cropH, canvasY - cropH / 2))

    const cropCanvas = document.createElement('canvas')
    cropCanvas.width = cropW
    cropCanvas.height = cropH
    const ctx = cropCanvas.getContext('2d')

    ctx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

    const result = await worker.recognize(cropCanvas, {}, { blocks: true })
    const words = extractWordsFromTesseractResult(result)

    if (!words.length) return null

    // Find the word closest to the tap center
    const localCenterX = canvasX - cropX
    const localCenterY = canvasY - cropY

    let closest = null
    let minDistance = Infinity

    for (const w of words) {
      const raw = (w.text || '').trim()
      const clean = raw.replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '').trim()
      if (!clean || clean.length < 1) continue

      const bbox = w.bbox || { x0: 0, y0: 0, x1: cropW, y1: cropH }
      const bx = (bbox.x0 + bbox.x1) / 2
      const by = (bbox.y0 + bbox.y1) / 2
      const dist = Math.hypot(bx - localCenterX, by - localCenterY)

      if (dist < minDistance) {
        minDistance = dist
        const absCanvasX = cropX + bbox.x0
        const absCanvasY = cropY + bbox.y0
        const absCanvasW = bbox.x1 - bbox.x0
        const absCanvasH = bbox.y1 - bbox.y0

        closest = {
          word: clean,
          normX: absCanvasX / canvas.width,
          normY: absCanvasY / canvas.height,
          normW: absCanvasW / canvas.width,
          normH: absCanvasH / canvas.height,
          x: Math.floor(absCanvasX / dpr),
          y: Math.floor(absCanvasY / dpr),
          w: Math.max(14, Math.ceil(absCanvasW / dpr)),
          h: Math.max(14, Math.ceil(absCanvasH / dpr))
        }
      }
    }

    if (closest) {
      closest.cx = closest.x + closest.w / 2
      closest.cy = closest.y + closest.h / 2
      logMobileDebug(`[OcrService] 🎯 Instant Tap OCR identified word: "${closest.word}"`)
    }

    return closest
  } catch (err) {
    logMobileDebug(`⚠️ [OcrService] Instant Tap OCR notice: ${err.message}`)
    return null
  }
}
