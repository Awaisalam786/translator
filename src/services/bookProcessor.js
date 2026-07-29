import { createWorker } from 'tesseract.js'
import * as pdfjsLib from 'pdfjs-dist'
import { detectLanguage } from './languageDetector'
import { saveLargeData } from './storageService'
import { logMobileDebug } from '../components/DebugOverlay'

// Disable external Web Workers in bookProcessor.js for 100% reliable zero-hang main-thread parsing
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = ''
} catch (e) {}

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
    reader.onerror = () => reject(reader.error || new Error('FileReader failed to read file ArrayBuffer.'))
    reader.readAsArrayBuffer(file)
  })
}

function isPdfBufferOrFile(file, buffer) {
  if (file?.type === 'application/pdf' || file?.name?.toLowerCase().endsWith('.pdf')) {
    return true
  }
  if (!buffer || buffer.byteLength < 4) return false
  const bytes = new Uint8Array(buffer, 0, 4)
  // Check PDF magic bytes '%PDF' (0x25, 0x50, 0x44, 0x46)
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
}

/**
 * Core Book Upload Processor
 */
export async function processBookUpload({ files, isPhotosMode = false, onProgress }) {
  if (!files || files.length === 0) {
    throw new Error('No file provided for upload.')
  }

  const bookId = 'book_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)
  const uploadDate = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  // ── Mode A: Photos of Pages (OCR via Tesseract.js) ─────────────────────────
  if (isPhotosMode || (files[0]?.type && files[0].type.startsWith('image/'))) {
    logMobileDebug(`[BookProcessor] Mode A: Photos OCR Mode initialized for ${files.length} images`)
    onProgress?.({ status: `Preparing ${files.length} image(s)...`, progress: 10 })

    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) {
      throw new Error('No valid image files provided for photos mode.')
    }

    let combinedText = ''
    const pages = []

    let worker = null
    try {
      try {
        worker = await createWorker('deu')
      } catch {
        try {
          worker = await createWorker('eng')
        } catch {
          worker = await createWorker()
        }
      }

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i]
        const pct = Math.round(10 + ((i + 1) / imageFiles.length) * 75)
        onProgress?.({ status: `Extracting text from page ${i + 1} of ${imageFiles.length}...`, progress: pct })

        const resizedDataUrl = await resizeImageIfNeeded(file)
        const ret = await worker.recognize(resizedDataUrl)
        const pageText = ret?.data?.text || ''

        pages.push({
          pageNumber: i + 1,
          text: pageText
        })
        combinedText += pageText + '\n\n'
      }

      await worker.terminate()
    } catch (ocrErr) {
      if (worker) {
        try { await worker.terminate() } catch (e) {}
      }
      throw new Error(`OCR Processing failed: ${ocrErr.message}`)
    }

    onProgress?.({ status: 'Detecting language...', progress: 88 })
    const { code: sourceLang, name: sourceLangName } = await detectLanguage(combinedText || imageFiles[0].name)

    const title = imageFiles.length === 1
      ? imageFiles[0].name.replace(/\.[^/.]+$/, '')
      : `Scanned Book (${imageFiles.length} Pages)`

    const thumbnail = pages.length > 0 ? await resizeImageIfNeeded(imageFiles[0], 300) : null

    const bookMetadata = {
      id: bookId,
      title,
      type: 'txt',
      totalPages: pages.length,
      sourceLang,
      sourceLangName,
      uploadDate,
      lastPage: 1,
      thumbnail
    }

    onProgress?.({ status: 'Saving scanned pages to device storage...', progress: 95 })
    await saveLargeData(`book_blob_${bookId}`, pages)

    return bookMetadata
  }

  // ── Mode B & C File Upload (.pdf or .txt) ──────────────────────────────────
  const file = files[0]
  logMobileDebug(`[BookProcessor] Upload started for 1 file(s) {"name":"${file.name}","size":${file.size},"type":"${file.type}"}`)
  onProgress?.({ status: 'Reading file...', progress: 15 })

  let arrayBuffer = null
  try {
    arrayBuffer = await readAsArrayBuffer(file)
    logMobileDebug(`[BookProcessor] Read ArrayBuffer successfully! {"byteLength":${arrayBuffer?.byteLength}}`)
  } catch (err) {
    logMobileDebug(`❌ [BookProcessor] ArrayBuffer read failed: ${err.message}`)
  }

  const isPdf = arrayBuffer && isPdfBufferOrFile(file, arrayBuffer)
  logMobileDebug(`[BookProcessor] PDF Magic-Bytes Check Result: ${isPdf ? 'PDF CONFIRMED (%PDF-)' : 'Not PDF'}`)

  // ── Mode B: PDF File (Checked via Extension, MIME, or %PDF- Magic Bytes) ─────
  if (isPdf) {
    onProgress?.({ status: 'Parsing PDF document...', progress: 30 })
    logMobileDebug('[BookProcessor] Processing in Mode B: PDF Document (Main-Thread Mode)')

    let totalPages = 1
    let sampleText = ''
    let thumbnail = null

    try {
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer.slice(0),
        disableWorker: true,
        disableStream: true,
        disableAutoFetch: false,
        isEvalSupported: false
      })

      const pdfDoc = await loadingTask.promise
      totalPages = pdfDoc.numPages || 1
      logMobileDebug('[BookProcessor] PDF.js parsed document instantly!', { totalPages })

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
    if (typeof file.text === 'function') {
      rawText = await file.text()
    } else {
      const decoder = new TextDecoder('utf-8')
      rawText = decoder.decode(arrayBuffer)
    }
  } catch (err) {
    throw new Error('Failed to read text file content.')
  }

  // Split text into ~2000-character logical reading pages
  const chunkSize = 2000
  const pages = []
  let offset = 0
  let pageNum = 1

  while (offset < rawText.length) {
    let end = Math.min(offset + chunkSize, rawText.length)
    if (end < rawText.length) {
      const lastSpace = rawText.lastIndexOf(' ', end)
      if (lastSpace > offset + 1000) end = lastSpace
    }
    const pageText = rawText.substring(offset, end).trim()
    if (pageText) {
      pages.push({ pageNumber: pageNum++, text: pageText })
    }
    offset = end
  }

  onProgress?.({ status: 'Detecting language...', progress: 85 })
  const { code: sourceLang, name: sourceLangName } = await detectLanguage(rawText.substring(0, 1500))

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
