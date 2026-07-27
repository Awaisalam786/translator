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
      cMapPacked: true
    })

    loadingTask.promise
      .then(pdf => {
        console.log('[VisualPdfReader] PDF loaded successfully! Total pages:', pdf.numPages)
        setPdfDoc(pdf)
        setLoading(false)
      })
      .catch(err => {
        console.error('[VisualPdfReader] Document loading failed:', err)
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
        const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2.5)) // Cap at 2.5x to balance crispness vs mobile memory
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

        // Build word-level token hit map for 100% accurate tap-to-translate
        const content = await page.getTextContent()
        if (cancelled) return

        const tokens = []
        for (const it of content.items) {
          if (!it.str || !it.str.trim()) continue

          const tx = pdfjsLib.Util.transform(viewport.transform, it.transform)
          const fh = Math.hypot(tx[0], tx[1])
          const lineX = Math.floor(tx[4])
          const lineY = Math.floor(tx[5] - fh * 0.85)
          const lineH = Math.ceil(fh * 1.25)
          const fullStr = it.str
          const totalW = Math.ceil(it.width * renderScale)
          const charWidth = fullStr.length ? (totalW / fullStr.length) : 8

          // Extract individual words with exact word-level bounding boxes
          const regex = /[\wäöüßÄÖÜéàèâêîôûùçœ'-]+/gi
          let match

          while ((match = regex.exec(fullStr)) !== null) {
            const rawWord = match[0]
            const cleanWord = rawWord.replace(/^[^a-zA-ZäöüßÄÖÜéàèâêîôûùçœ]+|[^a-zA-ZäöüßÄÖÜéàèâêîôûùçœ]+$/gi, '')
            if (!cleanWord || cleanWord.length < 2) continue

            const startIndex = match.index
            const wordW = Math.max(14, Math.ceil(rawWord.length * charWidth))
            const wordX = Math.floor(lineX + (startIndex * charWidth))

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

        logMobileDebug(`[VisualPdfReader] Page ${currentPage}: Extracted ${content.items.length} raw text items, built ${tokens.length} word tokens`)
        if (tokens.length === 0) {
          logMobileDebug(`⚠️ [VisualPdfReader] Notice: 0 word tokens extracted on page ${currentPage}. PDF might be a scanned image or non-standard font encoding.`)
        }

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

    // 1. Calculate raw tap offset in CSS DOM display space
    const domX = clientX - rect.left
    const domY = clientY - rect.top

    // 2. Convert DOM display coordinates to Canvas Buffer coordinate space
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const canvasX = domX * scaleX
    const canvasY = domY * scaleY

    logMobileDebug(`[VisualPdfReader] Tap DOM (${Math.round(domX)}, ${Math.round(domY)}) -> Canvas (${Math.round(canvasX)}, ${Math.round(canvasY)}) [DPI Scale: ${scaleX.toFixed(2)}x]`)

    let exactMatch = null
    let closestMatch = null
    let minDistance = 60 * scaleX // Search radius scaled to canvas buffer space

    for (const token of textItems) {
      const padY = 12 * scaleY
      const padX = 12 * scaleX
      if (canvasX >= (token.x - padX) && canvasX <= (token.x + token.w + padX) &&
          canvasY >= (token.y - padY) && canvasY <= (token.y + token.h + padY)) {
        exactMatch = token
        break
      }

      const dist = Math.hypot(canvasX - token.cx, canvasY - token.cy)
      if (dist < minDistance) {
        minDistance = dist
        closestMatch = token
      }
    }

    const selectedToken = exactMatch || closestMatch

    if (selectedToken) {
      logMobileDebug(`[VisualPdfReader] ✅ Word matched: "${selectedToken.word}"`)
      const clickRect = {
        left: Math.max(12, clientX - 20),
        top: clientY - 10,
        bottom: clientY + 14,
        right: clientX + 20,
        width: selectedToken.w || 40,
        height: selectedToken.h || 20
      }
      onSelectWord(selectedToken.word, clickRect)
    } else {
      logMobileDebug(`[VisualPdfReader] Tap at Canvas (${Math.round(canvasX)}, ${Math.round(canvasY)}) did not match any nearby word token.`)
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
              cursor: 'pointer',
              boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
              borderRadius: '6px',
              overflow: 'hidden',
              opacity: pageLoading ? 0.6 : 1,
              transition: 'opacity 0.15s ease',
              maxWidth: '100%',
              margin: '0 auto'
            }}
          >
          <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', height: 'auto' }} />

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
              {textItems.map((token, idx) => (
                <span
                  key={`${token.word}_${idx}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    const rect = e.currentTarget.getBoundingClientRect()
                    onSelectWord(token.word, rect)
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
