import React, { useState, useEffect, useRef } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Globe, Palette, AlertTriangle, HardDrive } from 'lucide-react'
import { getLargeData, saveBooksMetadata, getBooksMetadata } from '../services/storageService'
import TranslationSlip from './TranslationSlip'
import VisualPdfReader from './VisualPdfReader'
import StorageModal from './StorageModal'

export default function ReaderView({
  book,
  onBackToLibrary,
  savedWordsCount = 0,
  onOpenDeck,
  onOpenTheme,
  onToggleFavorite,
  isWordFavorite
}) {
  const [currentPage, setCurrentPage] = useState(book.lastPage || 1)
  const [targetLang, setTargetLang] = useState(() => localStorage.getItem('leselampe_target_lang') || 'en')
  const [bookData, setBookData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showStorageModal, setShowStorageModal] = useState(false)

  // Word Selection & Translation Slip State
  const [selectedWord, setSelectedWord] = useState(null)
  const [selectedRect, setSelectedRect] = useState(null)
  const [selectedTokenKey, setSelectedTokenKey] = useState(null)
  const [sentenceContext, setSentenceContext] = useState('')

  // State for font size of tapped word
  const [selectedFontSize, setSelectedFontSize] = useState('1.15rem')

  // Handle word tap in text / OCR / PDF layer
  const handleWordTap = (word, context = '', rect = null, tokenKey = null, fontSize = '1.15rem') => {
    const clean = (word || '').replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '').trim() || word
    if (clean && clean.length > 0) {
      setSelectedWord(clean)
      setSentenceContext(context)
      setSelectedRect(rect)
      setSelectedTokenKey(tokenKey)
      setSelectedFontSize(fontSize)
    }
  }

  // Persist target language choice
  useEffect(() => {
    localStorage.setItem('leselampe_target_lang', targetLang)
  }, [targetLang])

  // Load main book data blob from storage
  useEffect(() => {
    let isMounted = true
    setLoading(true)

    getLargeData(`book_blob_${book.id}`).then((data) => {
      if (isMounted) {
        setBookData(data)
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
    }
  }, [book.id])

  // Save current page state on navigation
  const handlePageChange = (newPage) => {
    const validPage = Math.max(1, Math.min(book.totalPages, newPage))
    setCurrentPage(validPage)
    clearSelection()

    // Update lastPage in books metadata
    const books = getBooksMetadata()
    const updated = books.map(b => b.id === book.id ? { ...b, lastPage: validPage } : b)
    saveBooksMetadata(updated)
  }

  const clearSelection = () => {
    setSelectedWord(null)
    setSelectedRect(null)
    setSelectedTokenKey(null)
    setSentenceContext('')
  }

  const progressPct = Math.round((currentPage / book.totalPages) * 100)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      backgroundColor: 'var(--bg-dark)',
      color: 'var(--text-main)',
      overflow: 'hidden',
      transition: 'background-color 0.25s ease, color 0.25s ease'
    }}>
      {/* ── Top Bar Header ────────────────────────────────────────────────────── */}
      <header style={{
        flexShrink: 0,
        backgroundColor: '#161922',
        borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
        padding: '0 16px',
        height: '52px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        zIndex: 50,
        gap: '12px'
      }}>
        {/* Left: Back to Shelf & Book Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', flexShrink: 0, maxWidth: '40%' }}>
          <button
            onClick={onBackToLibrary}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.09)',
              borderRadius: '6px',
              color: '#f8fafc',
              padding: '6px 12px',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
              minHeight: '34px',
              transition: 'background-color 0.15s ease'
            }}
          >
            <ArrowLeft size={15} />
            <span>Shelf</span>
          </button>

          <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <h2 style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '0.88rem',
              fontWeight: 600,
              color: '#f8fafc',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {book.title}
            </h2>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              {book.sourceLangName || 'German'} · {book.totalPages} pages
            </span>
          </div>
        </div>

        {/* Center: Top Page Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          padding: '3px 6px',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          flexShrink: 0
        }}>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: '#f8fafc',
              padding: '5px 8px',
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage <= 1 ? 0.3 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.78rem',
              fontWeight: 500,
              minHeight: '28px',
              transition: 'background-color 0.15s ease'
            }}
          >
            <ChevronLeft size={14} />
            <span>Prev</span>
          </button>

          <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: '65px', textAlign: 'center', color: '#f8fafc' }}>
            {currentPage} / {book.totalPages}
          </span>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= book.totalPages}
            style={{
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '6px',
              color: '#60a5fa',
              padding: '5px 10px',
              cursor: currentPage >= book.totalPages ? 'not-allowed' : 'pointer',
              opacity: currentPage >= book.totalPages ? 0.3 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.78rem',
              fontWeight: 600,
              minHeight: '28px',
              transition: 'background-color 0.15s ease'
            }}
          >
            <span>Next</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Right: Target Language Dropdown, Theme & Deck Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Globe size={14} color="#94a3b8" />
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              style={{
                backgroundColor: '#12151e',
                color: '#f8fafc',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                padding: '5px 8px',
                fontSize: '0.78rem',
                cursor: 'pointer',
                outline: 'none',
                minHeight: '34px'
              }}
            >
              <option value="en">English</option>
              <option value="ur">اردو</option>
              <option value="hi">हिंदी</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="ar">العربية</option>
              <option value="tr">Türkçe</option>
              <option value="zh">中文</option>
            </select>
          </div>

          {/* Storage Management Button */}
          <button
            onClick={() => setShowStorageModal(true)}
            title="Storage Management"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              color: '#f8fafc',
              padding: '6px 10px',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minHeight: '34px'
            }}
          >
            <HardDrive size={14} color="#94a3b8" />
            <span>Storage</span>
          </button>

          {/* Theme Button */}
          {onOpenTheme && (
            <button
              onClick={onOpenTheme}
              title="Theme Settings"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                color: '#f8fafc',
                padding: '6px 10px',
                fontSize: '0.78rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                minHeight: '34px'
              }}
            >
              <Palette size={14} color="#94a3b8" />
              <span>Theme</span>
            </button>
          )}

          {/* Deck Button */}
          {onOpenDeck && (
            <button
              onClick={onOpenDeck}
              style={{
                background: 'rgba(225, 29, 72, 0.12)',
                border: '1px solid rgba(225, 29, 72, 0.28)',
                borderRadius: '6px',
                color: '#f43f5e',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                minHeight: '34px',
                transition: 'all 0.15s ease'
              }}
            >
              <span>Deck ({savedWordsCount})</span>
            </button>
          )}
        </div>

        {/* Subtle 2px Progress Bar Line */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: `${progressPct}%`,
          height: '2px',
          background: 'linear-gradient(90deg, #e11d48 0%, #3b82f6 100%)',
          transition: 'width 0.25s ease'
        }} />
      </header>

      {/* Storage Modal */}
      {showStorageModal && (
        <StorageModal
          onClose={() => setShowStorageModal(false)}
          onBooksChanged={() => {
            const books = getBooksMetadata()
            const stillExists = books.some(b => b.id === book.id)
            if (!stillExists) {
              onBackToLibrary()
            }
          }}
        />
      )}

      {/* ── Floating Bottom Navigation Pill ── */}
      <div style={{
        position: 'fixed',
        bottom: 'calc(18px + var(--sab))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        backgroundColor: 'rgba(22, 25, 34, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        padding: '5px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.25)'
      }}>
        {/* Bottom Shelf Button Backup */}
        <button
          onClick={onBackToLibrary}
          title="Back to Shelf"
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: 'none',
            borderRadius: '16px',
            color: '#94a3b8',
            padding: '5px 10px',
            fontSize: '0.78rem',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            minHeight: '30px'
          }}
        >
          <ArrowLeft size={13} />
          <span>Shelf</span>
        </button>

        <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />

        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          style={{
            background: 'transparent',
            border: 'none',
            borderRadius: '16px',
            color: '#f8fafc',
            padding: '5px 10px',
            fontSize: '0.8rem',
            fontWeight: 500,
            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            opacity: currentPage <= 1 ? 0.3 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            minHeight: '30px'
          }}
        >
          <ChevronLeft size={14} />
          <span>Prev</span>
        </button>

        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f8fafc', minWidth: '60px', textAlign: 'center' }}>
          {currentPage} / {book.totalPages}
        </span>

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= book.totalPages}
          style={{
            background: 'rgba(59, 130, 246, 0.2)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            borderRadius: '16px',
            color: '#60a5fa',
            padding: '5px 12px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: currentPage >= book.totalPages ? 'not-allowed' : 'pointer',
            opacity: currentPage >= book.totalPages ? 0.3 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            minHeight: '30px'
          }}
        >
          <span>Next</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* ── Main Content Viewer Area ────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        overflow: book.type === 'pdf' ? 'hidden' : 'auto',
        backgroundColor: '#0e1117',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: book.type === 'pdf' ? '0' : '24px 16px 80px',
        boxSizing: 'border-box',
        width: '100%',
        height: '100%'
      }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '80px', color: '#94a3b8' }}>
            <Loader2 size={32} color="#d97706" style={{ animation: 'spin 1s linear infinite' }} />
            <span>Loading book contents…</span>
          </div>
        ) : !bookData ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px', marginTop: '60px', padding: '24px', backgroundColor: '#1a1d2e', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', maxWidth: '400px' }}>
            <AlertTriangle size={42} color="#ef4444" />
            <div>
              <h3 style={{ margin: '0 0 6px', color: '#fff' }}>Could Not Load Book Data</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                The file content could not be retrieved from local storage. This can happen if browser memory was cleared or storage quota was exceeded on mobile.
              </p>
            </div>
            <button
              onClick={onBackToLibrary}
              style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', backgroundColor: '#d97706', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              Back to Book Shelf
            </button>
          </div>
        ) : (
          <>
            {/* TYPE A: PDF Book */}
            {book.type === 'pdf' && (
              <VisualPdfReader
                fileBuffer={bookData}
                bookId={book.id}
                sourceLang={book.sourceLang || 'de'}
                currentPage={currentPage}
                onSelectWord={(word, rect) => handleWordTap(word, '', rect)}
              />
            )}

            {/* TYPE B: Text (.txt) Book */}
            {book.type === 'txt' && Array.isArray(bookData) && (
              <TextViewer
                pageText={bookData[currentPage - 1] || ''}
                selectedTokenKey={selectedTokenKey}
                onWordTap={handleWordTap}
              />
            )}

            {/* TYPE C: Photos of Pages */}
            {book.type === 'photos' && bookData?.pageImages && (
              <PhotoPageViewer
                imageDataUrl={bookData.pageImages[currentPage - 1]}
                ocrData={bookData.ocrPages?.[currentPage - 1]}
                selectedTokenKey={selectedTokenKey}
                onWordTap={handleWordTap}
              />
            )}
          </>
        )}
      </main>

      {/* ── Word Translation Slip Popup ──────────────────────────────────────── */}
      {selectedWord && (
        <TranslationSlip
          word={selectedWord}
          sourceLang={book.sourceLang || 'de'}
          targetLang={targetLang}
          sentenceContext={sentenceContext}
          targetRect={selectedRect}
          fontSize={selectedFontSize}
          isFavorite={isWordFavorite ? isWordFavorite(selectedWord) : false}
          onToggleFavorite={onToggleFavorite}
          onClose={clearSelection}
        />
      )}
    </div>
  )
}

// ── Text Page Component (spans for every word) ─────────────────────────────────

function TextViewer({ pageText, selectedTokenKey, onWordTap }) {
  if (!pageText) {
    return <div style={{ color: '#94a3b8' }}>Page unavailable</div>
  }

  const paragraphs = pageText.split('\n\n')

  return (
    <div style={{
      maxWidth: '740px',
      width: '100%',
      backgroundColor: '#1a1d2e',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '16px',
      padding: '40px 48px',
      boxSizing: 'border-box',
      boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
      color: '#e2e8f0',
      fontFamily: '"Merriweather", "Georgia", serif',
      fontSize: '1.15rem',
      lineHeight: 1.85,
      letterSpacing: '0.01em'
    }}>
      {paragraphs.map((para, pIdx) => {
        const tokens = para.split(/(\s+)/)
        return (
          <p key={pIdx} style={{ marginBottom: '1.4em', marginTop: 0 }}>
            {tokens.map((token, tIdx) => {
              if (/^\s+$/.test(token)) {
                return token
              }
              const key = `${pIdx}_${tIdx}`
              const isSelected = selectedTokenKey === key

              return (
                <span
                  key={tIdx}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const fs = window.getComputedStyle(e.currentTarget).fontSize
                    onWordTap(token, para, rect, key, fs)
                  }}
                  className="tappable-word"
                  style={{
                    cursor: 'pointer',
                    borderRadius: '4px',
                    padding: '2px 4px',
                    backgroundColor: isSelected ? '#d97706' : 'transparent',
                    color: isSelected ? '#ffffff' : 'inherit',
                    fontWeight: isSelected ? 700 : 'normal',
                    transition: 'all 0.1s ease'
                  }}
                >
                  {token}
                </span>
              )
            })}
          </p>
        )
      })}
    </div>
  )
}

// ── Photo Page Component with OCR Interactive Word Overlay ─────────────────────

function PhotoPageViewer({ imageDataUrl, ocrData, selectedTokenKey, onWordTap }) {
  if (!imageDataUrl) {
    return <div style={{ color: '#94a3b8' }}>Page image unavailable</div>
  }

  const words = ocrData?.words || []

  return (
    <div
      style={{
        position: 'relative',
        maxWidth: '800px',
        width: '100%',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#000000'
      }}
    >
      {/* Background Page Image */}
      <img
        src={imageDataUrl}
        alt="Page"
        style={{
          width: '100%',
          height: 'auto',
          display: 'block'
        }}
      />

      {/* Invisible Interactive Word Layer */}
      {words.map((w, idx) => {
        const leftPct = (w.x / ocrData.imageWidth) * 100
        const topPct = (w.y / ocrData.imageHeight) * 100
        const widthPct = (w.width / ocrData.imageWidth) * 100
        const heightPct = (w.height / ocrData.imageHeight) * 100
        const key = `ocr_${idx}`
        const isSelected = selectedTokenKey === key

        return (
          <div
            key={idx}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              onWordTap(w.word, ocrData.text, rect, key)
            }}
            className="ocr-word-hitbox"
            style={{
              position: 'absolute',
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: `${widthPct}%`,
              height: `${heightPct}%`,
              cursor: 'pointer',
              borderRadius: '2px',
              backgroundColor: isSelected ? 'rgba(217, 119, 6, 0.45)' : 'transparent',
              border: isSelected ? '1px solid #d97706' : 'none'
            }}
          />
        )
      })}
    </div>
  )
}
