import React, { useState, useEffect } from 'react'
import { BookOpen, Plus, Trash2, HardDrive, AlertTriangle, FileText, Image as ImageIcon, Bookmark, Sparkles, Palette } from 'lucide-react'
import { getBooksMetadata, deleteBookComplete, getStorageStatus } from '../services/storageService'
import { processBookUpload } from '../services/bookProcessor'

export default function LibraryShelf({ onSelectBook, onOpenDeck, onOpenAdminPanel, onOpenTheme, savedWordsCount = 0 }) {
  const [books, setBooks] = useState([])
  const [storageInfo, setStorageInfo] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')
  const [progressPct, setProgressPct] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)

  // Load books & storage estimate on mount
  useEffect(() => {
    loadLibraryData()
  }, [])

  const loadLibraryData = async () => {
    const list = getBooksMetadata()
    setBooks(list)
    const status = await getStorageStatus()
    setStorageInfo(status)
  }

  // Handle Book File Upload (.txt, .pdf, or photos)
  const handleFileUpload = async (files, isPhotosMode = false) => {
    if (!files || files.length === 0) return

    setIsProcessing(true)
    setErrorMsg('')
    setProgressPct(5)
    setProgressMsg('Preparing files…')

    try {
      const metadata = await processBookUpload({
        files,
        isPhotosMode,
        onProgress: ({ status, progress }) => {
          setProgressMsg(status)
          setProgressPct(progress)
        }
      })

      // Update books list in storage
      const currentBooks = getBooksMetadata()
      const updated = [metadata, ...currentBooks]
      localStorage.setItem('leselampe_books', JSON.stringify(updated))

      await loadLibraryData()
      setIsProcessing(false)
    } catch (err) {
      console.error('[Upload] Error:', err)
      setErrorMsg(err.message || 'Failed to process file. Please try again.')
      setIsProcessing(false)
    }
  }

  // Delete Book
  const handleDeleteBook = async (e, bookId, title) => {
    e.stopPropagation()
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      await deleteBookComplete(bookId)
      await loadLibraryData()
    }
  }

  // Drag and Drop Handlers
  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(Array.from(e.dataTransfer.files))
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-dark)',
      color: 'var(--text-main)',
      padding: '28px 24px 60px',
      boxSizing: 'border-box',
      transition: 'background-color 0.25s ease, color 0.25s ease'
    }}>
      {/* ── App Header ────────────────────────────────────────────────────────── */}
      <header style={{
        maxWidth: '1140px',
        margin: '0 auto 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '20px',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        {/* Brand Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--accent-gold) 0%, var(--accent-gold-hover) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 8px 20px rgba(0,0,0,0.25)'
          }}>
            <BookOpen size={24} />
          </div>

          <div>
            <h1 style={{
              fontFamily: '"Merriweather", "Georgia", serif',
              fontSize: '1.8rem',
              fontWeight: 700,
              color: 'var(--text-bright)',
              margin: '0 0 2px 0',
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              Leselampe<span style={{ color: 'var(--accent-gold)' }}>.</span>
            </h1>
            <p style={{
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              margin: 0
            }}>
              Foreign Language Reader with Tap-to-Translate
            </p>
          </div>
        </div>

        {/* Top Header Controls (Theme & Deck Buttons) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {onOpenTheme && (
            <button
              onClick={onOpenTheme}
              title="Theme Settings"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '24px',
                color: '#f8fafc',
                padding: '8px 14px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Palette size={16} color="#f59e0b" />
              <span>Theme</span>
            </button>
          )}

          {onOpenDeck && (
            <button
              onClick={onOpenDeck}
              style={{
                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                border: 'none',
                borderRadius: '24px',
                color: '#ffffff',
                padding: '8px 18px',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(217, 119, 6, 0.35)',
                transition: 'transform 0.15s ease'
              }}
            >
              <Bookmark size={16} />
              <span>Vocabulary Deck ({savedWordsCount})</span>
            </button>
          )}
        </div>
      </header>

      {/* ── Main Library Grid ─────────────────────────────────────────────────── */}
      <main style={{ maxWidth: '1140px', margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px'
        }}>
          <h2 style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#94a3b8',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Sparkles size={16} color="#d97706" />
            <span>Your Reading Shelf ({books.length})</span>
          </h2>
        </div>

        {/* Bookshelf Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '24px'
        }}>
          {/* ── Upload Book File Card ────────────────────────────────────────── */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              height: '260px',
              borderRadius: '16px',
              border: isDragOver ? '2px dashed #d97706' : '2px dashed rgba(255, 255, 255, 0.15)',
              backgroundColor: isDragOver ? 'rgba(217, 119, 6, 0.1)' : 'rgba(255, 255, 255, 0.03)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 16px',
              textAlign: 'center',
              boxSizing: 'border-box',
              transition: 'all 0.2s ease',
              boxShadow: '0 6px 20px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'rgba(217, 119, 6, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d97706',
              marginBottom: '12px'
            }}>
              <Plus size={24} />
            </div>

            <label style={{
              fontSize: '0.98rem',
              fontWeight: 700,
              color: '#f8fafc',
              cursor: 'pointer',
              marginBottom: '4px'
            }}>
              Upload a Book
              <input
                type="file"
                accept=".txt,.pdf"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.length && handleFileUpload(Array.from(e.target.files))}
              />
            </label>

            <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '14px' }}>
              Drag & drop .PDF or .TXT file
            </span>

            {/* Photos of Pages Sub-Option */}
            <label style={{
              fontSize: '0.78rem',
              color: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '20px',
              padding: '4px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600
            }}>
              <ImageIcon size={13} />
              <span>Or add page photos (OCR)</span>
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.length && handleFileUpload(Array.from(e.target.files), true)}
              />
            </label>
          </div>

          {/* ── Book Spine / Thumbnail Cover Cards ────────────────────────────── */}
          {books.map((book) => {
            const spineColor = getTitleColor(book.title)
            const hasThumbnail = Boolean(book.thumbnail)

            return (
              <div
                key={book.id}
                onClick={() => onSelectBook(book)}
                className="book-spine-card"
                style={{
                  height: '260px',
                  borderRadius: '16px',
                  background: hasThumbnail
                    ? `linear-gradient(to bottom, rgba(15, 18, 29, 0.45) 0%, rgba(15, 18, 29, 0.92) 100%), url(${book.thumbnail}) center / cover no-repeat`
                    : `linear-gradient(145deg, ${spineColor.bg1} 0%, ${spineColor.bg2} 100%)`,
                  borderLeft: '4px solid rgba(255, 255, 255, 0.3)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '22px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                  boxShadow: '0 10px 28px rgba(0,0,0,0.5)',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Hover Delete Button */}
                <button
                  onClick={(e) => handleDeleteBook(e, book.id, book.title)}
                  title="Delete book"
                  className="delete-spine-btn"
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0, 0, 0, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 3
                  }}
                >
                  <Trash2 size={14} />
                </button>

                {/* Top Info */}
                <div style={{ zIndex: 2 }}>
                  <span style={{
                    display: 'inline-block',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    backgroundColor: 'rgba(15, 18, 29, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(4px)',
                    color: '#f59e0b',
                    padding: '3px 9px',
                    borderRadius: '6px',
                    marginBottom: '14px'
                  }}>
                    {book.sourceLangName || 'German'}
                  </span>

                  <h3 style={{
                    fontFamily: '"Merriweather", "Georgia", serif',
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    lineHeight: 1.35,
                    margin: 0,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textShadow: '0 2px 8px rgba(0,0,0,0.8)'
                  }}>
                    {book.title}
                  </h3>
                </div>

                {/* Bottom Footer Info */}
                <div style={{
                  fontSize: '0.78rem',
                  color: 'rgba(255, 255, 255, 0.85)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '10px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.15)',
                  zIndex: 2,
                  textShadow: '0 1px 4px rgba(0,0,0,0.8)'
                }}>
                  <span style={{ fontWeight: 600 }}>{book.totalPages} {book.totalPages === 1 ? 'page' : 'pages'}</span>
                  <span>{book.uploadDate}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Empty State Message */}
        {books.length === 0 && !isProcessing && (
          <div style={{
            textAlign: 'center',
            padding: '50px 20px',
            color: '#64748b'
          }}>
            <p style={{
              fontFamily: '"Merriweather", "Georgia", serif',
              fontSize: '1.2rem',
              fontStyle: 'italic',
              margin: '0 0 6px 0',
              color: '#94a3b8'
            }}>
              Your shelf is empty
            </p>
            <p style={{ fontSize: '0.88rem', margin: 0 }}>
              Upload a book above to start your reading session.
            </p>
          </div>
        )}
      </main>

      {/* ── Processing Overlay Modal ────────────────────────────────────────── */}
      {isProcessing && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 18, 29, 0.88)',
          backdropFilter: 'blur(8px)',
          zIndex: 300,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '380px',
            backgroundColor: '#1a1d2e',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '32px 28px',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
          }}>
            <div className="spinner-loader" style={{ margin: '0 auto 18px' }} />

            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: '0 0 14px 0' }}>
              {progressMsg}
            </h3>

            {/* Progress Bar */}
            <div style={{
              width: '100%',
              height: '7px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '10px'
            }}>
              <div style={{
                width: `${progressPct}%`,
                height: '100%',
                backgroundColor: '#d97706',
                transition: 'width 0.2s ease'
              }} />
            </div>

            <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>
              {progressPct}%
            </span>
          </div>
        </div>
      )}

      {/* Error Alert Modal */}
      {errorMsg && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 310,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '360px',
            backgroundColor: '#1a1d2e',
            borderRadius: '14px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            padding: '24px',
            textAlign: 'center'
          }}>
            <AlertTriangle size={32} color="#ef4444" style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: '0 0 8px 0' }}>
              Processing Failed
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 20px 0' }}>
              {errorMsg}
            </p>
            <button
              onClick={() => setErrorMsg('')}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Storage Status Meter Footer ────────────────────────────────────────── */}
      {storageInfo && (
        <footer style={{
          maxWidth: '1140px',
          margin: '48px auto 0',
          paddingTop: '20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          fontSize: '0.82rem',
          color: storageInfo.isWarning ? '#f59e0b' : '#64748b'
        }}>
          <HardDrive size={15} color="#d97706" />
          <span>{storageInfo.message}</span>
        </footer>
      )}
    </div>
  )
}

// Generate consistent warm HSL spine colors from book title hash
function getTitleColor(title = '') {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = Math.abs(hash) % 360
  return {
    bg1: `hsl(${h}, 45%, 26%)`,
    bg2: `hsl(${(h + 25) % 360}, 50%, 17%)`
  }
}
