import { createWorker } from 'tesseract.js'
import * as pdfjsLib from 'pdfjs-dist'
import { detectLanguage } from './languageDetector'
import { saveLargeData } from './storageService'
import { logMobileDebug } from '../components/DebugOverlay'

const PDFJS_VERSION = pdfjsLib.version || '4.10.38'
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`

/**
 * Cross-browser FileReader helpers for mobile WebViews / iOS Safari / Android Chrome
 */
function readAsArrayBuffer(file) {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer().catch(() => readAsArrayBufferFileReader(file))
  }
  return readAsArrayBufferFileReader(file)
}

function readAsArrayBufferFileReader(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('FileReader failed to read file arrayBuffer.'))
    reader.readAsArrayBuffer(file)
  })
}

function readAsText(file) {
  if (typeof file.text === 'function') {
    return file.text().catch(() => readAsTextFileReader(file))
  }
  return readAsTextFileReader(file)
}

function readAsTextFileReader(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('FileReader failed to read file text.'))
    reader.readAsText(file)
  })
}

/**
 * Robust Magic-Bytes detection for PDF files (works on mobile where file.type or file.name may be missing/generic)
 */
function isPdfBufferOrFile(file, arrayBuffer) {
  if (file?.type === 'application/pdf') return true
  if (file?.name && file.name.toLowerCase().endsWith('.pdf')) return true

  if (arrayBuffer && arrayBuffer.byteLength >= 5) {
    const arr = new Uint8Array(arrayBuffer, 0, 5)
    // Magic bytes for %PDF- are 0x25, 0x50, 0x44, 0x46, 0x2D
    if (arr[0] === 0x25 && arr[1] === 0x50 && arr[2] === 0x44 && arr[3] === 0x46) {
      return true
    }
  }
  return false
}

/**
 * Process uploaded files (.txt, .pdf, or photos of pages) into a structured Book object
 * Includes automatic Thumbnail generation for PDF and Photos, saved 100% locally in IndexedDB.
 */
export async function processBookUpload({ files, isPhotosMode = false, onProgress }) {
  if (!files || files.length === 0) {
    throw new Error('No files selected for upload.')
  }

  const bookId = `book_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
  const uploadDate = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  logMobileDebug(`[BookProcessor] Upload started for ${files.length} file(s)`, {
    name: files[0]?.name,
    size: files[0]?.size,
    type: files[0]?.type,
    isPhotosMode
  })

  // ── Mode A: Photos of Pages (Multi-Image OCR) ──────────────────────────────────
  if (isPhotosMode || (files[0].type && files[0].type.startsWith('image/'))) {
    logMobileDebug('[BookProcessor] Processing in Mode A: Photos (OCR)')
    onProgress?.({ status: 'Processing page images...', progress: 10 })

    const pageImages = []
    const ocrPages = []
    let sampleTextAcc = ''

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      onProgress?.({
        status: `Recognizing text on page ${i + 1} of ${files.length}…`,
        progress: Math.round(15 + ((i + 1) / files.length) * 75)
      })

      // Downscale image for speed & memory safety on mobile
      const resizedDataUrl = await resizeImageIfNeeded(file, 1600)
      pageImages.push(resizedDataUrl)

      // Run OCR on page
      const ocrResult = await runOcrOnImage(resizedDataUrl)
      ocrPages.push(ocrResult)

      // Accumulate sample text for language detection
      if (sampleTextAcc.length < 1500) {
        sampleTextAcc += ocrResult.words.map(w => w.word).join(' ') + ' '
      }
    }

    // Language Detection
    onProgress?.({ status: 'Detecting language...', progress: 95 })
    const { code: sourceLang, name: sourceLangName } = await detectLanguage(sampleTextAcc)

    const title = files.length === 1
      ? (files[0].name ? files[0].name.replace(/\.[^/.]+$/, '') : 'Photo Page')
      : `Book Photo Pages (${files.length} pages)`

    const thumbnail = pageImages[0] || null

    const bookMetadata = {
      id: bookId,
      title,
      type: 'photos',
      totalPages: files.length,
      sourceLang,
      sourceLangName,
      uploadDate,
      lastPage: 1,
      thumbnail
    }

    onProgress?.({ status: 'Saving locally to device storage...', progress: 98 })
    logMobileDebug('[BookProcessor] Saving photo pages to storage...')
    await saveLargeData(`book_blob_${bookId}`, { pageImages, ocrPages })
    logMobileDebug('[BookProcessor] Saved photo pages successfully!', { bookId })

    return bookMetadata
  }

  const file = files[0]

  // Read raw ArrayBuffer upfront with mobile fallback
  onProgress?.({ status: 'Reading file data...', progress: 15 })
  logMobileDebug('[BookProcessor] Reading ArrayBuffer for file...', { name: file.name, size: file.size })
  let arrayBuffer = null
  try {
    arrayBuffer = await readAsArrayBuffer(file)
    logMobileDebug('[BookProcessor] Read ArrayBuffer successfully!', { byteLength: arrayBuffer?.byteLength })
  } catch (err) {
    logMobileDebug(`❌ [BookProcessor] ArrayBuffer read failed: ${err.message}`)
  }

  const isPdf = arrayBuffer && isPdfBufferOrFile(file, arrayBuffer)
  logMobileDebug(`[BookProcessor] PDF Magic-Bytes Check Result: ${isPdf ? 'PDF CONFIRMED (%PDF-)' : 'Not PDF'}`)

  // ── Mode B: PDF File (Checked via Extension, MIME, or %PDF- Magic Bytes) ─────
  if (isPdf) {
    onProgress?.({ status: 'Parsing PDF document...', progress: 30 })
    logMobileDebug('[BookProcessor] Processing in Mode B: PDF Document')

    let totalPages = 1
    let sampleText = ''
    let thumbnail = null

    try {
      let pdfDoc = null
      try {
        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer.slice(0),
          cMapUrl: `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`,
          disableStream: true,
          disableAutoFetch: false,
          disableFontFace: false
        })

        // Timeout fallback for older desktop browsers (e.g. Windows 7 / Chrome CORS WebWorker block)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Worker initialization timeout')), 2800)
        )

        pdfDoc = await Promise.race([loadingTask.promise, timeoutPromise])
      } catch (workerErr) {
        logMobileDebug(`⚠️ [BookProcessor] Worker timeout/error: ${workerErr.message}. Retrying in Main-Thread FakeWorker mode...`)
        const fallbackTask = pdfjsLib.getDocument({
          data: arrayBuffer.slice(0),
          disableWorker: true,
          disableStream: true,
          disableAutoFetch: false
        })
        pdfDoc = await fallbackTask.promise
      }

      totalPages = pdfDoc.numPages || 1
      logMobileDebug('[BookProcessor] PDF.js parsed document!', { totalPages })

      // Extract sample text from first page for language detection
      try {
        const page1 = await pdfDoc.getPage(1)
        const textContent = await page1.getTextContent()
        sampleText = textContent.items.map(it => it.str).join(' ')
        thumbnail = await renderPdfThumbnail(page1)
      } catch (e) {
        logMobileDebug(`⚠️ [BookProcessor] PDF metadata/thumbnail notice: ${e.message}`)
      }
    } catch (pdfErr) {
      logMobileDebug(`❌ [BookProcessor] PDF.js parsing error: ${pdfErr.message}`)
    }

    onProgress?.({ status: 'Detecting language...', progress: 85 })
    const { code: sourceLang, name: sourceLangName } = await detectLanguage(sampleText || file.name || 'Book')

    const title = file.name ? file.name.replace(/\.[^/.]+$/, '') : 'PDF Document'
    const bookMetadata = {
      id: bookId,
      title,
      type: 'pdf',
      totalPages,
      sourceLang,
      sourceLangName,
      uploadDate,
      lastPage: 1,
      thumbnail
    }

    onProgress?.({ status: 'Saving PDF locally to device storage...', progress: 95 })
    logMobileDebug('[BookProcessor] Saving PDF ArrayBuffer to storage...')
    await saveLargeData(`book_blob_${bookId}`, arrayBuffer)
    logMobileDebug('[BookProcessor] Saved PDF to storage successfully!', { bookId, size: arrayBuffer.byteLength })

    return bookMetadata
  }

  // ── Mode C: Text File (.txt) ──────────────────────────────────────────────────
  onProgress?.({ status: 'Reading text file...', progress: 30 })

  let rawText = ''
  try {
    rawText = await readAsText(file)
  } catch (err) {
    throw new Error(`Failed to read text file: ${err.message}`)
  }

  if (!rawText || !rawText.trim()) {
    throw new Error('The selected text file is empty.')
  }

  onProgress?.({ status: 'Paginating text...', progress: 60 })
  const pages = paginateText(rawText, 1100)

  onProgress?.({ status: 'Detecting language...', progress: 85 })
  const sampleText = pages[0] || rawText
  const { code: sourceLang, name: sourceLangName } = await detectLanguage(sampleText)

  const title = file.name ? file.name.replace(/\.[^/.]+$/, '') : 'Text Document'
  const bookMetadata = {
    id: bookId,
    title,
    type: 'txt',
    totalPages: pages.length,
    sourceLang,
    sourceLangName,
    uploadDate,
    lastPage: 1,
    thumbnail: null
  }

  onProgress?.({ status: 'Saving text locally to device storage...', progress: 95 })
  await saveLargeData(`book_blob_${bookId}`, pages)

  return bookMetadata
}

// ── Render PDF Page 1 as JPEG Thumbnail Data URL ─────────────────────────────
async function renderPdfThumbnail(page) {
  try {
    const vp = page.getViewport({ scale: 0.5 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(vp.width)
    canvas.height = Math.floor(vp.height)

    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    await page.render({ canvasContext: ctx, viewport: vp }).promise
    return canvas.toDataURL('image/jpeg', 0.8)
  } catch (e) {
    console.warn('[BookProcessor] renderPdfThumbnail error:', e)
    return null
  }
}

// ── Downscale large uploaded photos for OCR speed & memory ────────────────────
function resizeImageIfNeeded(file, maxDimension = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()

    reader.onload = (e) => {
      img.onload = () => {
        let { width, height } = img

        if (width <= maxDimension && height <= maxDimension) {
          resolve(e.target.result)
          return
        }

        if (width > height) {
          height = Math.round((height * maxDimension) / width)
          width = maxDimension
        } else {
          width = Math.round((width * maxDimension) / height)
          maxDimension = height
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Run Tesseract OCR on a page image ─────────────────────────────────────────
async function runOcrOnImage(imageDataUrl) {
  try {
    const worker = await createWorker('deu+eng+fra+spa')
    const ret = await worker.recognize(imageDataUrl)
    const words = (ret.data.words || [])
      .filter(w => w.text && w.text.trim())
      .map(w => ({
        word: w.text.trim(),
        bbox: w.bbox
      }))

    await worker.terminate()
    return {
      text: ret.data.text || '',
      words,
      imageWidth: ret.data.imageColor || 1000,
      imageHeight: ret.data.imageHeight || 1400
    }
  } catch (err) {
    console.warn('[BookProcessor] OCR error:', err)
    return { text: '', words: [] }
  }
}

// ── Paginate raw text into ~1100 character reading pages ──────────────────────
function paginateText(text, targetLength = 1100) {
  const paragraphs = text.split(/\n\s*\n/)
  const pages = []
  let currentPageText = ''

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    if (currentPageText.length + trimmed.length > targetLength && currentPageText.length > 0) {
      pages.push(currentPageText.trim())
      currentPageText = trimmed + '\n\n'
    } else {
      currentPageText += trimmed + '\n\n'
    }
  }

  if (currentPageText.trim()) {
    pages.push(currentPageText.trim())
  }

  return pages.length > 0 ? pages : [text]
}
