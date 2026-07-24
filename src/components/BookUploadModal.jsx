import React, { useState } from 'react'
import { X, Upload, BookOpen, FileText, CheckCircle2, Sparkles, Loader2 } from 'lucide-react'
import { SAMPLE_BOOKS } from '../data/sampleBooks'
import { parseBookFile } from '../services/bookParser'

export default function BookUploadModal({ 
  onClose, 
  onSelectBook, 
  activeBookId 
}) {
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('')

  // Parse uploaded file into structured chapters & paragraphs
  const handleFileUpload = async (file) => {
    if (!file) return

    setLoading(true)
    setLoadingText(`Parsing ${file.name}...`)

    try {
      const bookObj = await parseBookFile(file)
      onSelectBook(bookObj)
      onClose()
    } catch (err) {
      console.error('[BookUpload] Error parsing book:', err)
      alert(`Could not parse ${file.name}. Please ensure it is a valid TXT, EPUB, or PDF file.`)
    } finally {
      setLoading(false)
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0])
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>Book Library & File Upload</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Upload any local book (.txt, .epub, .pdf) or select from sample classics
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Drag and Drop Zone */}
        <div 
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragActive ? 'var(--accent-primary)' : 'var(--border-color)'}`,
            borderRadius: '16px',
            padding: '32px',
            textAlign: 'center',
            background: dragActive ? 'var(--accent-light)' : 'var(--bg-card)',
            transition: 'all 0.2s ease',
            cursor: 'pointer',
            marginBottom: '28px'
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
              <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 600 }}>{loadingText}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Extracting text chapters and paragraphs...</span>
            </div>
          ) : (
            <>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <Upload size={24} />
              </div>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Click or Drag & Drop any book file
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Supports EPUB, PDF, TXT, and Markdown documents
              </p>

              <input 
                type="file" 
                accept=".txt,.md,.epub,.pdf" 
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                style={{ display: 'none' }}
                id="book-file-input"
              />
              <label htmlFor="book-file-input" className="nav-btn primary" style={{ display: 'inline-flex', marginTop: '16px', cursor: 'pointer' }}>
                Browse Files on Device
              </label>
            </>
          )}
        </div>

        {/* Pre-loaded Sample Books Grid */}
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="var(--accent-primary)" />
            <span>Classic Books Library</span>
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '16px' }}>
            {SAMPLE_BOOKS.map(book => {
              const isSelected = activeBookId === book.id
              return (
                <div
                  key={book.id}
                  onClick={() => {
                    onSelectBook(book)
                    onClose()
                  }}
                  style={{
                    background: 'var(--bg-card)',
                    border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    borderRadius: '12px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                    position: 'relative',
                    boxShadow: isSelected ? '0 4px 20px rgba(99, 102, 241, 0.25)' : 'none'
                  }}
                >
                  {/* Book Cover Banner */}
                  <div 
                    style={{ 
                      height: '80px', 
                      borderRadius: '8px', 
                      background: book.coverGradient, 
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'center',
                      color: '#fff'
                    }}
                  >
                    <BookOpen size={28} />
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: '1.3', marginBottom: '4px' }}>
                      {book.title}
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {book.author}
                    </p>
                  </div>

                  {isSelected && (
                    <div style={{ position: 'absolute', top: '10px', right: '10px', color: 'var(--accent-primary)' }}>
                      <CheckCircle2 size={18} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

