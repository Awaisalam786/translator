import JSZip from 'jszip'


/**
 * Clean text from binary garbage or control characters
 */
function sanitizeText(raw) {
  if (!raw) return ''
  return raw
    // Remove non-printable control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFFFD]/g, '')
    // Normalize multiple spaces
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/**
 * Parse plain text or Markdown files (.txt, .md)
 */
export async function parseTxtFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = sanitizeText(e.target.result)
      const rawParagraphs = content
        .split(/\n\s*\n/)
        .map(p => sanitizeText(p))
        .filter(p => p.length > 5)

      const chapters = []
      const chunkSize = 10
      for (let i = 0; i < rawParagraphs.length; i += chunkSize) {
        chapters.push({
          id: Math.floor(i / chunkSize) + 1,
          title: `Chapter ${Math.floor(i / chunkSize) + 1}`,
          paragraphs: rawParagraphs.slice(i, i + chunkSize)
        })
      }

      resolve({
        id: `txt-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        author: 'Uploaded Document',
        coverGradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
        chapters: chapters.length > 0 ? chapters : [{
          id: 1,
          title: 'Full Document',
          paragraphs: [content]
        }]
      })
    }
    reader.onerror = (err) => reject(err)
    reader.readAsText(file, 'UTF-8')
  })
}

/**
 * Parse EPUB files (.epub) using JSZip
 */
export async function parseEpubFile(file) {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)
  
  // Find all HTML / XHTML files in the EPUB archive
  const htmlFiles = []
  zip.forEach((relativePath, zipEntry) => {
    if (/\.(html|xhtml|htm)$/i.test(relativePath) && !relativePath.includes('toc') && !relativePath.includes('nav')) {
      htmlFiles.push(zipEntry)
    }
  })

  // Sort files logically
  htmlFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

  const chapters = []
  let chapterIndex = 1

  for (const zipEntry of htmlFiles) {
    const htmlText = await zipEntry.async('string')
    
    // Parse HTML string to DOM
    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlText, 'text/html')
    
    // Extract paragraph texts
    const pElements = Array.from(doc.querySelectorAll('p, h1, h2, h3, h4, div'))
    const paragraphs = pElements
      .map(el => sanitizeText(el.textContent))
      .filter(text => text.length > 10)

    if (paragraphs.length > 0) {
      // Find chapter header if present
      const h1 = doc.querySelector('h1, h2, h3')?.textContent
      const title = sanitizeText(h1) || `Chapter ${chapterIndex}`

      chapters.push({
        id: chapterIndex,
        title,
        paragraphs
      })
      chapterIndex++
    }
  }

  // Fallback if no structured html files found
  if (chapters.length === 0) {
    return parseTxtFile(file)
  }

  return {
    id: `epub-${Date.now()}`,
    title: file.name.replace(/\.[^/.]+$/, ''),
    author: 'EPUB Book',
    coverGradient: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
    chapters
  }
}

/**
 * Parse PDF files (.pdf) — stores raw ArrayBuffer for exact visual rendering.
 * We do NOT extract text here. The VisualPdfReader renders page pixels via PDF.js canvas
 * and builds click-to-lookup word overlays from PDF text item coordinates.
 */
export async function parsePdfFile(file) {
  const arrayBuffer = await file.arrayBuffer()

  return {
    id: `pdf-${Date.now()}`,
    title: file.name.replace(/\.[^/.]+$/, ''),
    author: 'PDF Document',
    coverGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    fileBuffer: arrayBuffer,
    isPdf: true,
    chapters: [{
      id: 1,
      title: file.name.replace(/\.[^/.]+$/, ''),
      paragraphs: ['This PDF is rendered visually. Click any word to look it up.']
    }]
  }
}


/**
 * Universal Master Book File Parser
 */
export async function parseBookFile(file) {
  const name = file.name.toLowerCase()
  try {
    if (name.endsWith('.epub')) {
      return await parseEpubFile(file)
    } else if (name.endsWith('.pdf')) {
      return await parsePdfFile(file)
    } else {
      return await parseTxtFile(file)
    }
  } catch (err) {
    console.error('[BookParser] Parsing error:', err)
    // Fallback attempt
    return await parseTxtFile(file)
  }
}
