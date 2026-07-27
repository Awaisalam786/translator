import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { ZoomIn, ZoomOut, Loader2, Maximize2, Minimize2, AlertTriangle, RefreshCw } from 'lucide-react'
import { logMobileDebug } from './DebugOverlay'

// Set up PDF.js worker CDN URL with fallback handling
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
} catch (e) {
  console.warn('[PDF.js] Worker setup notice:', e)
}

export default function VisualPdfReader({ fileBuffer, currentPage = 1, onSelectWord }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const wrapperRef = useRef(null)

  const [pdfDoc, setPdfDoc] = useState(null)
  const [pdfError, setPdfError] = useState(null)
  const [scaleMode, setScaleMode] = useState('width') // 'width' (Fit Width, fills display), 'page' (Fit Page), or 'custom'
  const [customScale, setCustomScale] = useState(null)
  const [autoScaleW, setAutoScaleW] = useState(1.0)
  const [autoScaleP, setAutoScaleP] = useState(1.0)
  const [loading, setLoading] = useState(true)
  const [pageLoading, setPageLoading] = useState(false)
  const [textItems, setTextItems] = useState([])

  // ── Load PDF Document ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!fileBuffer) return
    setLoading(true)
    setPdfError(null)
    setPdfDoc(null)
    setTextItems([])

    console.log('[VisualPdfReader] Loading PDF document buffer of size:', fileBuffer?.byteLength || fileBuffer?.length)

    let bufferCopy = null
    try {
      if (fileBuffer instanceof ArrayBuffer) {
        bufferCopy = fileBuffer.slice(0)
      } else if (fileBuffer?.buffer instanceof ArrayBuffer) {
        bufferCopy = fileBuffer.buffer.slice(0)
      } else {
        bufferCopy = fileBuffer
      }
    } catch (e) {
      bufferCopy = fileBuffer
    }

    const loadingTask = pdfjsLib.getDocument({
      data: bufferCopy,
      cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/standard_fonts/`,
      disableStream: true,
      disableAutoFetch: false,
      disableFontFace: false,
      isEvalSupported: false
    })

    loadingTask.promise
      .then(pdf => {
        logMobileDebug(`[VisualPdfReader] PDF document loaded successfully! Total pages: ${pdf.numPages}`)
        setPdfDoc(pdf)
        setLoading(false)
      })
      .catch(err => {
        console.error('[VisualPdfReader] Document loading failed:', err)
        logMobileDebug(`❌ [VisualPdfReader] PDF loading error: ${err.message}`)
        setPdfError(err.message || 'Could not parse PDF file format. The file may be corrupt or encrypted.')
        setLoading(false)
      })
  }, [fileBuffer])

  // ── Recalculate Fit Width and Fit Page Scales ──────────────────────────────
  const updateScales = useCallback(() => {
    if (!pdfDoc || !wrapperRef.current) return
    pdfDoc.getPage(currentPage || 1).then(page => {
      const vp = page.getViewport({ scale: 1 })
      const wrapperEl = wrapperRef.current
      if (!wrapperEl) return

      const availW = Math.max(300, wrapperEl.clientWidth - 40)
      const availH = Math.max(400, wrapperEl.clientHeight - 40)

      const fitW = availW / vp.width
      const fitH = availH / vp.height

      // Cap scale between 0.75 and 1.25 for comfortable reading without giant 200%+ overflow
      setAutoScaleW(Math.max(0.75, Math.min(fitW, 1.25)))
      setAutoScaleP(Math.max(0.6, Math.min(fitW, fitH, 1.15)))
    })
  }, [pdfDoc, currentPage])

  useEffect(() => {
    updateScales()
    window.addEventListener('resize', updateScales)
    return () => window.removeEventListener('resize', updateScales)
  }, [updateScales])

  // Active Effective Scale
  let effectiveScale = autoScaleW
  if (scaleMode === 'custom' && customScale) {
    effectiveScale = customScale
  } else if (scaleMode === 'page') {
    effectiveScale = autoScaleP
  } else {
    effectiveScale = autoScaleW
  }

  const renderTaskRef = useRef(null)

  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  // ── Render PDF Page to Canvas ─────────────────────────────────────────────
  useEffect(() => {
    if (!pdfDoc || effectiveScale <= 0) return
    let cancelled = false
    setPageLoading(true)

    async function render() {
      try {
        const page = await pdfDoc.getPage(currentPage)
        if (cancelled) return

        // Account for high-DPI Retina mobile screens (devicePixelRatio)
        const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2.5))
        const renderScale = effectiveScale * dpr

        const viewport = page.getViewport({ scale: renderScale })
        const canvas = canvasRef.current
        if (!canvas) return

        // Set internal canvas resolution to high-DPI buffer
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)

        // Set CSS display dimensions to logical screen size
        const cssWidth = Math.floor(viewport.width / dpr)
        const cssHeight = Math.floor(viewport.height / dpr)
        canvas.style.width = `${cssWidth}px`
        canvas.style.height = `${cssHeight}px`
        setContainerSize({ w: cssWidth, h: cssHeight })

        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Cancel any active PDF.js render operation on this canvas before starting a new one (prevents zoom race condition)
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel()
          } catch (e) {
            // Ignore cancellation warning
          }
          renderTaskRef.current = null
        }

        const renderTask = page.render({ canvasContext: ctx, viewport })
        renderTaskRef.current = renderTask

        try {
          await renderTask.promise
          renderTaskRef.current = null
        } catch (renderErr) {
          renderTaskRef.current = null
          if (renderErr?.name === 'RenderingCancelledException' || renderErr?.message?.includes('cancelled')) {
            logMobileDebug('[VisualPdfReader] Render cancelled due to rapid scale/page change.')
            return
          }
          throw renderErr
        }

        if (cancelled) return

        logMobileDebug(`[VisualPdfReader] Crisp Retina Canvas rendered: Page ${currentPage} [Scale: ${effectiveScale.toFixed(2)}x, DPR: ${dpr}x, Resolution: ${canvas.width}x${canvas.height}px]`)

        // Pre-evaluate Operator List to force PDF.js font/CMap objects compilation before text extraction
        try {
          await page.getOperatorList()
          logMobileDebug(`[VisualPdfReader] Page ${currentPage}: getOperatorList() completed. Fonts/CMaps compiled in memory.`)
        } catch (opErr) {
          logMobileDebug(`⚠️ [VisualPdfReader] Page ${currentPage} getOperatorList notice: ${opErr.message}`)
        }

        if (cancelled) return

        // Multi-Strategy Text Extraction Pipeline (Parses Form XObjects, Marked Content & Mixed Image/Text Streams)
        let content = null

        // Strategy 1: Uncombined text extraction (gives exact individual X & Y coordinates for EVERY word in complex layouts)
        try {
          content = await page.getTextContent({ disableCombineTextItems: true })
          logMobileDebug(`[VisualPdfReader] Page ${currentPage} getTextContent() Strategy 1 (Uncombined): ${content?.items?.length || 0} raw text items`)
        } catch (e1) {
          logMobileDebug(`⚠️ [VisualPdfReader] Page ${currentPage} Strategy 1 error: ${e1.message}`)
        }

        // Strategy 2: Standard combined text extraction fallback
        if (!content || !content.items || content.items.length === 0) {
          try {
            content = await page.getTextContent()
            logMobileDebug(`[VisualPdfReader] Page ${currentPage} getTextContent() Strategy 2 (Standard): ${content?.items?.length || 0} items extracted`)
          } catch (e2) {
            logMobileDebug(`⚠️ [VisualPdfReader] Page ${currentPage} Strategy 2 error: ${e2.message}`)
          }
        }

        // Strategy 3: Marked Content fallback with 200ms delay
        if (!content || !content.items || content.items.length === 0) {
          await new Promise(r => setTimeout(r, 200))
          if (cancelled) return
          try {
            content = await page.getTextContent({ includeMarkedContent: true })
            logMobileDebug(`[VisualPdfReader] Page ${currentPage} getTextContent() Strategy 3 (Marked): ${content?.items?.length || 0} items extracted`)
          } catch (e3) {
            logMobileDebug(`⚠️ [VisualPdfReader] Page ${currentPage} Strategy 3 error: ${e3.message}`)
          }
        }

        if (cancelled) return
        const textItemsList = content?.items || []

        const tokens = []
        for (const it of textItemsList) {
          if (!it.str || !it.str.trim()) continue

          const tx = pdfjsLib.Util.transform(viewport.transform, it.transform)
          const fh = Math.hypot(tx[0], tx[1]) / dpr
          const lineX = Math.floor(tx[4] / dpr)
          const lineY = Math.floor((tx[5] - (fh * dpr * 0.85)) / dpr)
          const lineH = Math.ceil(fh * 1.25)
          // Normalize string to NFC and replace soft hyphens / zero-width spaces with standard spaces
          const fullStr = (it.str || '').normalize('NFC').replace(/[\u00AD\u200B\uFEFF\u200E\u200F\u00A0]/g, ' ')
          const totalW = Math.ceil(it.width * effectiveScale)

          // Measure character width accounting for space/tab gaps across table columns
          const spaceWidth = Math.max(3, Math.round(fh * 0.38))
          let nonSpaceCount = 0
          let spaceCount = 0
          for (let i = 0; i < fullStr.length; i++) {
            if (fullStr[i] === ' ' || fullStr[i] === '\t') spaceCount++
            else nonSpaceCount++
          }

          const totalSpaceW = spaceCount * spaceWidth
          const nonSpaceTotalW = Math.max(0, totalW - totalSpaceW)
          const charWidth = nonSpaceCount > 0 ? (nonSpaceTotalW / nonSpaceCount) : spaceWidth

          // Precompute exact cumulative X offset for each character position
          const charXOffsets = new Array(fullStr.length)
          let curX = 0
          for (let i = 0; i < fullStr.length; i++) {
            charXOffsets[i] = curX
            if (fullStr[i] === ' ' || fullStr[i] === '\t') {
              curX += spaceWidth
            } else {
              curX += charWidth
            }
          }

          // Extract individual words using Unicode property escape matching all international letters
          const regex = /[\p{L}\p{M}\p{N}'-]+/gu
          let match

          while ((match = regex.exec(fullStr)) !== null) {
            const rawWord = match[0]
            const cleanWord = rawWord.replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '').trim()
            if (!cleanWord || cleanWord.length < 1) continue

            const startIndex = match.index
            const lastIndex = match.index + rawWord.length - 1
            const wordX = Math.floor(lineX + charXOffsets[startIndex])
            const wordW = Math.max(10, Math.ceil((charXOffsets[lastIndex] + charWidth) - charXOffsets[startIndex]))

            tokens.push({
              word: cleanWord,
              x: wordX,
              y: lineY,
              w: wordW,
              h: lineH,
              cx: wordX + wordW / 2,
              cy: lineY + lineH / 2
            })
          }
        }

        // Strategy 4: Instant Canvas OCR Fallback for 0-token or low-token pages (< 10 words)
        if (tokens.length < 10 && canvas) {
          logMobileDebug(`⚠️ [VisualPdfReader] Only ${tokens.length} PDF.str tokens found on Page ${currentPage}. Initiating Canvas Tesseract OCR Fallback...`)
          try {
            const { createWorker } = await import('tesseract.js')
            let worker = null
            try {
              worker = await createWorker('deu')
            } catch {
              try {
                worker = await createWorker('eng')
              } catch {
                worker = await createWorker()
              }
            }

            const ret = await worker.recognize(canvas)
            await worker.terminate()

            if (ret?.data?.words) {
              let ocrAddedCount = 0
              for (const w of ret.data.words) {
                const rawText = w.text ? w.text.trim() : ''
                const clean = rawText.replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '').trim()
                if (!clean || clean.length < 1) continue

                const bbox = w.bbox
                const wordX = Math.floor(bbox.x0 / dpr)
                const wordY = Math.floor(bbox.y0 / dpr)
                const wordW = Math.max(10, Math.ceil((bbox.x1 - bbox.x0) / dpr))
                const wordH = Math.max(10, Math.ceil((bbox.y1 - bbox.y0) / dpr))

                tokens.push({
                  word: clean,
                  x: wordX,
                  y: wordY,
                  w: wordW,
                  h: wordH,
                  cx: wordX + wordW / 2,
                  cy: wordY + wordH / 2
                })
                ocrAddedCount++
              }
              logMobileDebug(`[VisualPdfReader] ✅ Canvas OCR Fallback completed: Extracted ${ocrAddedCount} word tokens for Page ${currentPage}!`)
            }
          } catch (ocrErr) {
            logMobileDebug(`❌ [VisualPdfReader] Canvas OCR Fallback error on Page ${currentPage}: ${ocrErr.message}`)
          }
        }

        logMobileDebug(`[VisualPdfReader] Page ${currentPage}: Final Token Count = ${tokens.length} CSS-aligned word tokens`)

        setTextItems(tokens)
        setPageLoading(false)
      } catch (e) {
        if (!cancelled) {
          console.error('[VisualPdfReader] Render error:', e)
          logMobileDebug(`❌ [VisualPdfReader] Render error: ${e.message}`)
          setPageLoading(false)
        }
      }
    }

    render()
    return () => {
      cancelled = true
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel() } catch (e) {}
        renderTaskRef.current = null
      }
    }
  }, [pdfDoc, currentPage, effectiveScale])

  const [selectedWordToken, setSelectedWordToken] = useState(null)

  // Clear active word highlight when page changes
  useEffect(() => {
    setSelectedWordToken(null)
  }, [currentPage])

  // ── Mobile Touch & Click Tap-to-Translate Handler ──────────────────────────────
  const handleTapOnPage = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return

    if (!textItems.length) {
      logMobileDebug(`⚠️ [VisualPdfReader] Tap ignored: 0 text tokens available on Page ${currentPage}`)
      return
    }

    // Calculate tap offset in CSS DOM display space
    const domX = clientX - rect.left
    const domY = clientY - rect.top

    // Strict Bounding Box Containment with tight 4px tolerance (no broad radial matching)
    let strictMatch = null
    const padX = 4
    const padY = 4

    for (const token of textItems) {
      if (domX >= (token.x - padX) && domX <= (token.x + token.w + padX) &&
          domY >= (token.y - padY) && domY <= (token.y + token.h + padY)) {
        strictMatch = token
        break
      }
    }

    if (strictMatch) {
      logMobileDebug(`[VisualPdfReader] ✅ Exact Word Hit: "${strictMatch.word}" (x:${strictMatch.x}, y:${strictMatch.y}, w:${strictMatch.w})`)
      setSelectedWordToken(strictMatch)
      const clickRect = {
        left: rect.left + strictMatch.x,
        top: rect.top + strictMatch.y,
        bottom: rect.top + strictMatch.y + strictMatch.h,
        right: rect.left + strictMatch.x + strictMatch.w,
        width: strictMatch.w,
        height: strictMatch.h
      }
      onSelectWord(strictMatch.word, clickRect)
    } else {
      logMobileDebug(`[VisualPdfReader] Tap at (${Math.round(domX)}, ${Math.round(domY)}) missed all word bounding boxes.`)
    }
  }, [textItems, currentPage, onSelectWord])

  const handleClick = (e) => {
    handleTapOnPage(e.clientX, e.clientY)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: '#94a3b8' }}>
        <Loader2 size={32} color="#d97706" style={{ animation: 'spin 1s linear infinite' }} />
        <span>Loading PDF document…</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Zoom & Screen Fit Toolbar */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '6px 16px',
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-subtle)',
        zIndex: 10,
        transition: 'background-color 0.25s ease'
      }}>
        {/* Zoom Out */}
        <button
          onClick={() => {
            setScaleMode('custom')
            setCustomScale(s => Math.max(0.4, +((s ?? effectiveScale) - 0.15).toFixed(2)))
          }}
          title="Zoom Out"
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)',
            borderRadius: '6px', color: 'var(--text-bright)', padding: '4px 8px', cursor: 'pointer'
          }}
        >
          <ZoomOut size={15} />
        </button>

        {/* Current Zoom Percentage */}
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-bright)', minWidth: '46px', textAlign: 'center' }}>
          {Math.round(effectiveScale * 100)}%
        </span>

        {/* Zoom In */}
        <button
          onClick={() => {
            setScaleMode('custom')
            setCustomScale(s => Math.min(3.0, +((s ?? effectiveScale) + 0.15).toFixed(2)))
          }}
          title="Zoom In"
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)',
            borderRadius: '6px', color: 'var(--text-bright)', padding: '4px 8px', cursor: 'pointer'
          }}
        >
          <ZoomIn size={15} />
        </button>

        {/* Fit Width Button (Fills screen display width comfortably) */}
        <button
          onClick={() => {
            setScaleMode('width')
            setCustomScale(null)
          }}
          style={{
            background: scaleMode === 'width' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.06)',
            border: 'none', borderRadius: '6px', color: '#ffffff',
            padding: '4px 10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '4px'
          }}
        >
          <Maximize2 size={13} />
          <span>Fit Width</span>
        </button>

        {/* Fit Page Button */}
        <button
          onClick={() => {
            setScaleMode('page')
            setCustomScale(null)
          }}
          style={{
            background: scaleMode === 'page' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.06)',
            border: 'none', borderRadius: '6px', color: '#ffffff',
            padding: '4px 10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '4px'
          }}
        >
          <Minimize2 size={13} />
          <span>Fit Page</span>
        </button>

        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '10px' }}>
          Tap any word in the PDF
        </span>
      </div>

      {/* PDF Viewport Container (Fills available space) */}
      <div
        ref={wrapperRef}
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          backgroundColor: 'var(--bg-dark)',
          padding: '16px 12px 90px',
          boxSizing: 'border-box',
          width: '100%',
          height: '100%',
          transition: 'background-color 0.25s ease'
        }}
      >
        {pdfError ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px', marginTop: '60px', padding: '24px', backgroundColor: '#1a1d2e', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.3)', maxWidth: '400px' }}>
            <AlertTriangle size={42} color="#ef4444" />
            <div>
              <h3 style={{ margin: '0 0 6px', color: '#fff' }}>PDF Reader Notice</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                {pdfError}
              </p>
            </div>
          </div>
        ) : (
          <div
            ref={containerRef}
            onClick={handleClick}
            style={{
              position: 'relative',
              width: containerSize.w > 0 ? `${containerSize.w}px` : 'auto',
              height: containerSize.h > 0 ? `${containerSize.h}px` : 'auto',
              cursor: 'pointer',
              boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
              borderRadius: '6px',
              overflow: 'hidden',
              opacity: pageLoading ? 0.6 : 1,
              transition: 'opacity 0.15s ease',
              margin: '0 auto'
            }}
          >
          <canvas ref={canvasRef} style={{ display: 'block', width: containerSize.w > 0 ? `${containerSize.w}px` : 'auto', height: containerSize.h > 0 ? `${containerSize.h}px` : 'auto' }} />

          {/* Interactive Pixel-Perfect Text Layer Overlay */}
          {!pageLoading && textItems.length > 0 && (
            <div
              className="pdf-text-layer"
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                overflow: 'hidden'
              }}
            >
              {/* Active Tapped Word Highlight Box */}
              {selectedWordToken && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${selectedWordToken.x}px`,
                    top: `${selectedWordToken.y}px`,
                    width: `${selectedWordToken.w}px`,
                    height: `${selectedWordToken.h}px`,
                    backgroundColor: 'rgba(245, 158, 11, 0.38)',
                    border: '1.5px solid #f59e0b',
                    borderRadius: '3px',
                    boxShadow: '0 0 10px rgba(245, 158, 11, 0.5)',
                    pointerEvents: 'none',
                    zIndex: 10,
                    transition: 'all 0.15s ease-out'
                  }}
                />
              )}

              {textItems.map((token, idx) => (
                <span
                  key={`${token.word}_${idx}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTapOnPage(e.clientX, e.clientY)
                  }}
                  style={{
                    position: 'absolute',
                    left: `${token.x}px`,
                    top: `${token.y}px`,
                    width: `${token.w}px`,
                    height: `${token.h}px`,
                    pointerEvents: 'auto',
                    cursor: 'pointer'
                  }}
                  className="pdf-word-span"
                  title={token.word}
                />
              ))}
            </div>
          )}

          {pageLoading && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.2)'
            }}>
              <Loader2 size={32} color="#d97706" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  )
}
