import { createWorker } from 'tesseract.js'
import { detectLanguage } from './languageDetector'
import { saveLargeData } from './storageService'

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

  // ── Mode A: Photos of Pages (Multi-Image OCR) ──────────────────────────────────
  if (isPhotosMode || files[0].type.startsWith('image/')) {
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

      // Downscale image for speed
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
      ? files[0].name.replace(/\.[^/.]+$/, '')
      : `Book Photo Pages (${files.length} pages)`

    // Page 1 is auto-thumbnail
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

    // Save page images and OCR caches in local IndexedDB
    onProgress?.({ status: 'Saving locally to database...', progress: 98 })
    await saveLargeData(`book_blob_${bookId}`, { pageImages, ocrPages })

    return bookMetadata
  }

  const file = files[0]
  const ext = file.name.split('.').pop().toLowerCase()

  // ── Mode B: PDF File ──────────────────────────────────────────────────────────
  if (ext === 'pdf' || file.type === 'application/pdf') {
    onProgress?.({ status: 'Loading PDF document...', progress: 20 })

    const arrayBuffer = await file.arrayBuffer()

    let totalPages = 1
    let sampleText = ''
    let thumbnail = null

    if (window.pdfjsLib) {
      try {
        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer.slice(0) })
        const pdfDoc = await loadingTask.promise
        totalPages = pdfDoc.numPages

        // Extract sample text from first page for language detection
        const page1 = await pdfDoc.getPage(1)
        const textContent = await page1.getTextContent()
        sampleText = textContent.items.map(it => it.str).join(' ')

        // Render automatic thumbnail of Page 1
        thumbnail = await renderPdfThumbnail(page1)
      } catch (e) {
        console.warn('[BookProcessor] Could not extract PDF metadata/thumbnail:', e)
      }
    }

    onProgress?.({ status: 'Detecting language...', progress: 85 })
    const { code: sourceLang, name: sourceLangName } = await detectLanguage(sampleText || file.name)

    const title = file.name.replace(/\.[^/.]+$/, '')
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
    await saveLargeData(`book_blob_${bookId}`, arrayBuffer)

    return bookMetadata
  }

  // ── Mode C: Text File (.txt) ──────────────────────────────────────────────────
  onProgress?.({ status: 'Reading text file...', progress: 30 })

  const rawText = await file.text()
  if (!rawText || !rawText.trim()) {
    throw new Error('The selected text file is empty.')
  }

  onProgress?.({ status: 'Paginating text...', progress: 60 })
  const pages = paginateText(rawText, 1100)

  onProgress?.({ status: 'Detecting language...', progress: 85 })
  const sampleText = pages[0] || rawText
  const { code: sourceLang, name: sourceLangName } = await detectLanguage(sampleText)

  const title = file.name.replace(/\.[^/.]+$/, '')
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

// ── Downscale large uploaded photos for OCR speed ─────────────────────────────
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
  const worker = await createWorker('deu+eng+fra+spa')
  try {
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
    await worker.terminate()
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
