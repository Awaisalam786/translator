import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { ZoomIn, ZoomOut, Loader2, Maximize2, Minimize2, AlertTriangle } from 'lucide-react'
import { logMobileDebug } from './DebugOverlay'
import { recognizePageWithCache, recognizeTapCrop, getTapWorker } from '../services/ocrService'

// Set local PDF.js worker from local Vite build bundle (0ms offline load, never times out)
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker
} catch (e) {}

const getLocalOrigin = () => {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin
  }
  return ''
}

export default function VisualPdfReader({
  fileBuffer,
  bookId = 'pdf_book',
  sourceLang = 'de',
  currentPage = 1,
  onSelectWord
}) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const wrapperRef = useRef(null)

  const [pdfDoc, setPdfDoc] = useState(null)
  const [pdfError, setPdfError] = useState(null)
  const [scaleMode, setScaleMode] = useState('width')
  const [customScale, setCustomScale] = useState(null)
  const [autoScaleW, setAutoScaleW] = useState(1.0)
  const [autoScaleP, setAutoScaleP] = useState(1.0)
  const [loading, setLoading] = useState(true)
  const [pageLoading, setPageLoading] = useState(false)
  const [textItems, setTextItems] = useState([])
  const [isOcrScanning, setIsOcrScanning] = useState(false)
  const [tapScanningPos, setTapScanningPos] = useState(null)
  const [selectedWordToken, setSelectedWordToken] = useState(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  const renderTaskRef = useRef(null)
  const pointerDownPosRef = useRef({ x: 0, y: 0, time: 0 })

  // ── Load PDF Document ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!fileBuffer) return
    setLoading(true)
    setPdfError(null)
    setPdfDoc(null)
    setTextItems([])

    const getFreshBuffer = () => {
      try {
        if (fileBuffer instanceof ArrayBuffer) {
          return fileBuffer.slice(0)
        }
        if (fileBuffer?.buffer instanceof ArrayBuffer) {
          return fileBuffer.buffer.slice(0)
        }
        if (fileBuffer instanceof Uint8Array) {
          return new Uint8Array(fileBuffer).buffer.slice(0)
        }
      } catch (e) {}
      return fileBuffer
    }

    const loadPdfDoc = async () => {
      const origin = getLocalOrigin()
      const docParams = {
        data: getFreshBuffer(),
        cMapUrl: `${origin}/cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${origin}/standard_fonts/`,
        disableStream: true,
        disableAutoFetch: false,
        isEvalSupported: true
      }

      try {
        let pdf = null
        try {
          const loadingTask = pdfjsLib.getDocument(docParams)
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Worker initialization timeout')), 30000)
          )
          pdf = await Promise.race([loadingTask.promise, timeoutPromise])
        } catch (wErr) {
          logMobileDebug(`⚠️ [VisualPdfReader] Worker notice: ${wErr.message}. Retrying in Main-Thread mode...`)
          // Fallback with full local cmaps and standard fonts so no fonts are ever missing
          const fallbackTask = pdfjsLib.getDocument({
            ...docParams,
            data: getFreshBuffer(),
            disableWorker: true,
            isEvalSupported: true
          })
          pdf = await fallbackTask.promise
        }

        logMobileDebug(`[VisualPdfReader] PDF document loaded successfully! Total pages: ${pdf.numPages}`)
        setPdfDoc(pdf)
        setLoading(false)
      } catch (err) {
        console.error('[VisualPdfReader] Document loading failed:', err)
        logMobileDebug(`❌ [VisualPdfReader] PDF loading error: ${err.message}`)
        setPdfError(err.message || 'Could not parse PDF file format. The file may be corrupt or encrypted.')
        setLoading(false)
      }
    }

    loadPdfDoc()
  }, [fileBuffer])

  // ── Recalculate Fit Width and Fit Page Scales ──────────────────────────────
  const updateScales = useCallback(() => {
    if (!pdfDoc) return
    pdfDoc.getPage(currentPage || 1).then(page => {
      const vp = page.getViewport({ scale: 1 })
      const wrapperEl = wrapperRef.current
      const clientW = wrapperEl ? wrapperEl.clientWidth : (window.innerWidth || 360)
      const clientH = wrapperEl ? wrapperEl.clientHeight : (window.innerHeight || 640)

      const availW = Math.max(280, clientW - 24)
      const availH = Math.max(380, clientH - 24)

      const fitW = (vp.width && vp.width > 0) ? (availW / vp.width) : 1.0
      const fitH = (vp.height && vp.height > 0) ? (availH / vp.height) : 1.0

      const calculatedFitW = Math.max(0.25, Math.min(fitW, 2.2))
      const calculatedFitP = Math.max(0.2, Math.min(fitW, fitH, 1.8))

      setAutoScaleW(calculatedFitW)
      setAutoScaleP(calculatedFitP)
    }).catch(e => {
      console.warn('[VisualPdfReader] Page viewport error:', e)
      setAutoScaleW(1.0)
      setAutoScaleP(1.0)
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

  // Clear active word highlight when page changes
  useEffect(() => {
    setSelectedWordToken(null)
    setTapScanningPos(null)
  }, [currentPage])

  // ── Render PDF Page to Canvas & Extract Interactive Words ─────────────────
  useEffect(() => {
    if (!pdfDoc || effectiveScale <= 0) return
    let cancelled = false
    setPageLoading(true)
    setIsOcrScanning(false)

    async function render() {
      try {
        const page = await pdfDoc.getPage(currentPage)
        if (cancelled) return

        const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2.5))
        const renderScale = effectiveScale * dpr

        const viewport = page.getViewport({ scale: renderScale })
        const canvas = canvasRef.current
        if (!canvas) return

        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)

        const cssWidth = Math.floor(viewport.width / dpr)
        const cssHeight = Math.floor(viewport.height / dpr)
        canvas.style.width = `${cssWidth}px`
        canvas.style.height = `${cssHeight}px`
        setContainerSize({ w: cssWidth, h: cssHeight })

        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel() } catch (e) {}
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
            return
          }
          throw renderErr
        }

        if (cancelled) return

        logMobileDebug(`[VisualPdfReader] Page ${currentPage} rendered: ${canvas.width}x${canvas.height}px`)

        // ── Text Extraction Phase ──────────────────────────────────────────
        let content = null
        try {
          content = await page.getTextContent({ disableCombineTextItems: true })
        } catch (e1) {
          try {
            content = await page.getTextContent()
          } catch (e2) {}
        }

        const textItemsList = content?.items || []
        const tokens = []

        const measureCanvas = document.createElement('canvas')
        const mCtx = measureCanvas.getContext('2d')

        for (const it of textItemsList) {
          if (!it.str || !it.str.trim()) continue

          const tx = pdfjsLib.Util.transform(viewport.transform, it.transform)
          const fontScaleX = Math.hypot(tx[0], tx[1]) / dpr
          const fontScaleY = Math.hypot(tx[2], tx[3]) / dpr || fontScaleX
          const lineX = Math.floor(tx[4] / dpr)
          const baselineY = Math.floor(tx[5] / dpr)
          // Baseline alignment: font ascent is typically 85-90% of font height
          const lineY = Math.floor(baselineY - (fontScaleY * 0.9))
          const lineH = Math.ceil(fontScaleY * 1.35)
          const totalW = Math.ceil(it.width * effectiveScale)

          const fullStr = (it.str || '').normalize('NFC').replace(/[\u00AD\u200B\uFEFF\u200E\u200F\u00A0]/g, ' ')

          mCtx.font = `${Math.round(fontScaleY)}px sans-serif`
          const measuredTotalW = mCtx.measureText(fullStr).width || totalW
          const scaleRatio = measuredTotalW > 0 ? (totalW / measuredTotalW) : 1.0

          const regex = /[\p{L}\p{M}\p{N}'-]+/gu
          let match

          while ((match = regex.exec(fullStr)) !== null) {
            const rawWord = match[0]
            const cleanWord = rawWord.replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '').trim()
            if (!cleanWord || cleanWord.length < 1) continue

            const prefix = fullStr.substring(0, match.index)
            const prefixW = mCtx.measureText(prefix).width * scaleRatio
            const rawWordW = mCtx.measureText(rawWord).width * scaleRatio

            const wordX = Math.floor(lineX + prefixW)
            const wordW = Math.max(14, Math.ceil(rawWordW))

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

        if (cancelled) return

        // ── OCR Fallback for Scanned / Image PDFs ("Pixel Words") ─────────
        if (tokens.length < 8 && canvas) {
          logMobileDebug(`[VisualPdfReader] Scanned/Image PDF detected on Page ${currentPage} (${tokens.length} text items). Starting Page OCR...`)
          setIsOcrScanning(true)
          // Eagerly warm up tap worker so on-demand taps respond in milliseconds
          getTapWorker(sourceLang).catch(() => {})

          recognizePageWithCache(bookId, currentPage, canvas, dpr, sourceLang)
            .then(ocrTokens => {
              if (cancelled) return
              setIsOcrScanning(false)
              if (ocrTokens && ocrTokens.length > 0) {
                logMobileDebug(`[VisualPdfReader] ✅ OCR complete! Added ${ocrTokens.length} interactive words to Page ${currentPage}`)
                setTextItems(ocrTokens)
              }
            })
            .catch(err => {
              if (cancelled) return
              setIsOcrScanning(false)
              logMobileDebug(`⚠️ [VisualPdfReader] OCR notice: ${err.message}`)
            })
        }

        logMobileDebug(`[VisualPdfReader] Page ${currentPage}: ${tokens.length} vector text tokens ready.`)
        setTextItems(tokens)
        setPageLoading(false)
      } catch (e) {
        if (!cancelled) {
          console.error('[VisualPdfReader] Render error:', e)
          logMobileDebug(`❌ [VisualPdfReader] Render error: ${e.message}`)
          setPageLoading(false)
          setIsOcrScanning(false)
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
  }, [pdfDoc, currentPage, effectiveScale, bookId, sourceLang])

  // ── Word Selection Dispatcher ─────────────────────────────────────────────
  const selectToken = useCallback((token) => {
    if (!token || !token.word) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()

    setSelectedWordToken(token)
    setTapScanningPos(null)

    const clickRect = {
      left: rect.left + token.x,
      top: rect.top + token.y,
      bottom: rect.top + token.y + token.h,
      right: rect.left + token.x + token.w,
      width: token.w,
      height: token.h
    }

    logMobileDebug(`[VisualPdfReader] 🎯 Selected Word: "${token.word}"`)
    onSelectWord(token.word, clickRect)
  }, [onSelectWord])

  // ── Mobile Touch & Click Tap-to-Translate Fallback Handler ────────────────
  const handleTapOnPage = useCallback(async (clientX, clientY) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return

    const domX = clientX - rect.left
    const domY = clientY - rect.top

    // 1. Check existing tokens with generous finger touch padding
    let matchedToken = null
    const padX = 12
    const padY = 10

    for (const token of textItems) {
      if (domX >= (token.x - padX) && domX <= (token.x + token.w + padX) &&
          domY >= (token.y - padY) && domY <= (token.y + token.h + padY)) {
        matchedToken = token
        break
      }
    }

    // 2. Same-Row Horizontal Search (Within 50px)
    if (!matchedToken) {
      let minRowXDist = 50
      for (const token of textItems) {
        const inSameRow = (domY >= (token.y - 14) && domY <= (token.y + token.h + 14))
        if (inSameRow) {
          const xDist = Math.abs(domX - token.cx)
          if (xDist < minRowXDist) {
            minRowXDist = xDist
            matchedToken = token
          }
        }
      }
    }

    // 3. Generous Radius Search (Within 35px)
    if (!matchedToken) {
      let minFallbackDist = 35
      for (const token of textItems) {
        const dist = Math.hypot(domX - token.cx, domY - token.cy)
        if (dist < minFallbackDist) {
          minFallbackDist = dist
          matchedToken = token
        }
      }
    }

    if (matchedToken) {
      selectToken(matchedToken)
      return
    }

    // 4. INSTANT TAP-TO-OCR FALLBACK: For Scanned / Image PDFs ("Pixel Words")
    logMobileDebug(`[VisualPdfReader] Tap at (${Math.round(domX)}, ${Math.round(domY)}) - running Instant Tap OCR...`)
    setTapScanningPos({ x: domX, y: domY })

    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2.5))
    try {
      const cropToken = await Promise.race([
        recognizeTapCrop(canvas, domX, domY, dpr, sourceLang),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Tap OCR timeout')), 12000))
      ])

      setTapScanningPos(null)
      if (cropToken && cropToken.word) {
        setTextItems(prev => {
          const exists = prev.some(t => t.word === cropToken.word && Math.abs(t.x - cropToken.x) < 25 && Math.abs(t.y - cropToken.y) < 25)
          return exists ? prev : [...prev, cropToken]
        })
        selectToken(cropToken)
      } else {
        logMobileDebug(`[VisualPdfReader] Tap at (${Math.round(domX)}, ${Math.round(domY)}) detected no text.`)
      }
    } catch (e) {
      setTapScanningPos(null)
      logMobileDebug(`⚠️ [VisualPdfReader] Tap OCR notice: ${e.message}`)
    }
  }, [textItems, selectToken, sourceLang])

  // ── Single Click vs Drag Selection Discriminator ─────────────────────────
  const handlePointerDown = (e) => {
    pointerDownPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now()
    }
  }

  const handlePointerUp = (e) => {
    const dx = Math.abs(e.clientX - pointerDownPosRef.current.x)
    const dy = Math.abs(e.clientY - pointerDownPosRef.current.y)
    const dist = Math.hypot(dx, dy)

    // Check if user has an active text selection from dragging
    const selection = window.getSelection()
    const hasSelection = selection && !selection.isCollapsed && selection.toString().trim().length > 0

    // If dragged (> 6px movement) or text is selected, allow native text selection and DO NOT trigger single-word tap dictionary
    if (dist > 6 || hasSelection) {
      return
    }

    // Single click / tap: find target token directly from clicked DOM span
    const wordSpan = e.target.closest('.pdf-text-word')
    if (wordSpan && wordSpan.dataset.tokenIdx != null) {
      const idx = Number(wordSpan.dataset.tokenIdx)
      const token = textItems[idx]
      if (token) {
        selectToken(token)
        return
      }
    }

    // Fallback: clicked on canvas or between tokens
    handleTapOnPage(e.clientX, e.clientY)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: '#94a3b8' }}>
        <Loader2 size={32} color="#f59e0b" style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontWeight: 600 }}>Loading PDF document…</span>
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
        flexWrap: 'wrap',
        gap: '8px',
        padding: '0 16px',
        height: '42px',
        backgroundColor: '#161922',
        borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
        zIndex: 10,
        transition: 'background-color 0.15s ease'
      }}>
        {/* Segmented Zoom Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '2px',
          gap: '2px'
        }}>
          <button
            onClick={() => {
              setScaleMode('custom')
              setCustomScale(s => Math.max(0.4, +((s ?? effectiveScale) - 0.15).toFixed(2)))
            }}
            title="Zoom Out"
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: '4px',
              color: '#94a3b8',
              width: '28px',
              height: '28px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <ZoomOut size={14} />
          </button>

          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#f8fafc', minWidth: '44px', textAlign: 'center' }}>
            {Math.round(effectiveScale * 100)}%
          </span>

          <button
            onClick={() => {
              setScaleMode('custom')
              setCustomScale(s => Math.min(3.0, +((s ?? effectiveScale) + 0.15).toFixed(2)))
            }}
            title="Zoom In"
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: '4px',
              color: '#94a3b8',
              width: '28px',
              height: '28px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <ZoomIn size={14} />
          </button>
        </div>

        {/* Fit Modes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => {
              setScaleMode('width')
              setCustomScale(null)
            }}
            style={{
              background: scaleMode === 'width' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              border: scaleMode === 'width' ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              color: scaleMode === 'width' ? '#60a5fa' : '#94a3b8',
              padding: '0 10px',
              height: '28px',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.15s ease'
            }}
          >
            <Maximize2 size={12} />
            <span>Fit Width</span>
          </button>

          <button
            onClick={() => {
              setScaleMode('page')
              setCustomScale(null)
            }}
            style={{
              background: scaleMode === 'page' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              border: scaleMode === 'page' ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              color: scaleMode === 'page' ? '#60a5fa' : '#94a3b8',
              padding: '0 10px',
              height: '28px',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.15s ease'
            }}
          >
            <Minimize2 size={12} />
            <span>Fit Page</span>
          </button>
        </div>

        {/* OCR Background Scanning Subtle Badge */}
        {isOcrScanning && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.22)',
            borderRadius: '6px',
            padding: '2px 8px',
            fontSize: '0.72rem',
            color: '#fbbf24',
            fontWeight: 500
          }}>
            <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Preparing text…</span>
          </div>
        )}

        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
          Tap to translate · Drag to select
        </span>
      </div>

      {/* PDF Viewport Container */}
      <div
        ref={wrapperRef}
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          backgroundColor: '#0e1117',
          padding: '24px 16px 100px',
          boxSizing: 'border-box',
          width: '100%',
          height: '100%',
          transition: 'background-color 0.15s ease'
        }}
      >
        {pdfError ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px', marginTop: '60px', padding: '24px', backgroundColor: '#161922', borderRadius: '12px', border: '1px solid rgba(225, 29, 72, 0.3)', maxWidth: '400px' }}>
            <AlertTriangle size={36} color="#e11d48" />
            <div>
              <h3 style={{ margin: '0 0 6px', color: '#f8fafc', fontSize: '0.95rem' }}>PDF Reader Notice</h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
                {pdfError}
              </p>
            </div>
          </div>
        ) : (
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            style={{
              position: 'relative',
              width: containerSize.w > 0 ? `${containerSize.w}px` : 'auto',
              height: containerSize.h > 0 ? `${containerSize.h}px` : 'auto',
              cursor: 'text',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '4px',
              overflow: 'hidden',
              opacity: pageLoading ? 0.6 : 1,
              transition: 'opacity 0.15s ease',
              margin: '0 auto',
              touchAction: 'manipulation'
            }}
          >
            <canvas
              ref={canvasRef}
              style={{
                display: 'block',
                width: containerSize.w > 0 ? `${containerSize.w}px` : 'auto',
                height: containerSize.h > 0 ? `${containerSize.h}px` : 'auto'
              }}
            />

            {/* Interactive Native Selectable Text Layer Overlay */}
            {!pageLoading && textItems.length > 0 && (
              <div
                className="pdf-text-layer"
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'auto',
                  overflow: 'hidden'
                }}
              >
                {/* Active Tapped Word Highlight Box: Subtle blue border/fill */}
                {selectedWordToken && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${selectedWordToken.x - 1}px`,
                      top: `${selectedWordToken.y - 1}px`,
                      width: `${selectedWordToken.w + 2}px`,
                      height: `${selectedWordToken.h + 2}px`,
                      backgroundColor: 'rgba(59, 130, 246, 0.12)',
                      border: '1.5px solid rgba(59, 130, 246, 0.8)',
                      borderRadius: '3px',
                      boxShadow: '0 0 8px rgba(59, 130, 246, 0.25)',
                      pointerEvents: 'none',
                      zIndex: 10,
                      transition: 'all 0.15s ease-out'
                    }}
                  />
                )}

                {/* Real Selectable Text Word Spans */}
                {textItems.map((token, idx) => (
                  <span
                    key={`${token.word}_${idx}`}
                    data-token-idx={idx}
                    className="pdf-text-word"
                    style={{
                      position: 'absolute',
                      left: `${token.x}px`,
                      top: `${token.y}px`,
                      width: `${token.w}px`,
                      height: `${token.h}px`,
                      fontSize: `${Math.max(9, Math.round(token.h * 0.82))}px`,
                      lineHeight: `${token.h}px`,
                      fontFamily: 'sans-serif',
                      color: 'transparent',
                      cursor: 'text',
                      userSelect: 'text',
                      WebkitUserSelect: 'text',
                      whiteSpace: 'pre',
                      overflow: 'hidden'
                    }}
                    title={token.word}
                  >
                    {token.word + ' '}
                  </span>
                ))}
              </div>
            )}

            {/* Tap Scanning Subtle Pulse Indicator */}
            {tapScanningPos && (
              <div
                style={{
                  position: 'absolute',
                  left: `${tapScanningPos.x - 14}px`,
                  top: `${tapScanningPos.y - 14}px`,
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  border: '1.5px solid #3b82f6',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  boxShadow: '0 0 10px rgba(59, 130, 246, 0.4)',
                  pointerEvents: 'none',
                  zIndex: 20,
                  animation: 'spin 0.8s linear infinite'
                }}
              />
            )}

            {/* Page Loading Spinner */}
            {pageLoading && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.25)',
                backdropFilter: 'blur(2px)'
              }}>
                <Loader2 size={28} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
