import React, { useState, useEffect } from 'react'
import { HardDrive, Trash2, RefreshCw, ShieldCheck, FileText, AlertCircle, CheckCircle2, X, Sparkles, BookOpen, Layers } from 'lucide-react'
import { getBooksMetadata, deleteBookComplete, getBookStorageSize, getStorageStatus } from '../services/storageService'
import { getTranslationCacheCount, clearTranslationCacheOnly } from '../services/translationService'

export default function StorageModal({ onClose, onBooksChanged }) {
  const [loading, setLoading] = useState(true)
  const [quotaInfo, setQuotaInfo] = useState({ usedMB: '0.0', quotaMB: '0', pctUsed: 0 })
  const [booksList, setBooksList] = useState([])
  const [cacheCount, setCacheCount] = useState(0)
  const [actionMsg, setActionMsg] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    loadStorageDetails()
  }, [])

  const loadStorageDetails = async () => {
    setLoading(true)

    // 1. Quota estimate
    const status = await getStorageStatus()
    setQuotaInfo(status)

    // 2. Per-book size breakdown
    const meta = getBooksMetadata()
    const detailed = await Promise.all(
      meta.map(async (b) => {
        const sizeBytes = await getBookStorageSize(b.id)
        const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2)
        const sizeKB = (sizeBytes / 1024).toFixed(0)
        return {
          ...b,
          sizeBytes,
          displaySize: sizeBytes > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`
        }
      })
    )
    setBooksList(detailed)

    // 3. Translation cache count
    setCacheCount(getTranslationCacheCount())
    setLoading(false)
  }

  // Handle clearing translation cache ONLY
  const handleClearCache = () => {
    clearTranslationCacheOnly()
    setCacheCount(0)
    setActionMsg('Translation cache cleared successfully! (Vocabulary & books preserved)')
    setTimeout(() => setActionMsg(''), 4000)
  }

  // Handle deleting individual book
  const handleDeleteBook = async (bookId, title) => {
    if (!window.confirm(`Delete "${title}" from local storage?`)) return
    setDeletingId(bookId)
    await deleteBookComplete(bookId)
    await loadStorageDetails()
    setDeletingId(null)
    if (onBooksChanged) onBooksChanged()
    setActionMsg(`Deleted "${title}"`)
    setTimeout(() => setActionMsg(''), 3000)
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(10, 13, 22, 0.82)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#161926',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        color: '#f8fafc',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: 'rgba(217, 119, 6, 0.18)',
              border: '1px solid rgba(217, 119, 6, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d97706'
            }}>
              <HardDrive size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                Storage Management
              </h2>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                View IndexedDB breakdown & clear cache safely
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Action Notification Banner */}
          {actionMsg && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '12px',
              color: '#10b981',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <CheckCircle2 size={18} />
              <span>{actionMsg}</span>
            </div>
          )}

          {/* 1. Overall Browser Storage Quota Progress Card */}
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '18px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>
                Device Storage Quota
              </span>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#d97706' }}>
                {quotaInfo.usedMB} MB used of ~{quotaInfo.quotaMB} MB ({quotaInfo.pctUsed}%)
              </span>
            </div>

            {/* Storage Progress Bar */}
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '10px'
            }}>
              <div style={{
                width: `${Math.max(2, Math.min(100, quotaInfo.pctUsed))}%`,
                height: '100%',
                backgroundColor: quotaInfo.pctUsed > 80 ? '#ef4444' : '#d97706',
                borderRadius: '4px',
                transition: 'width 0.3s ease'
              }} />
            </div>

            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              {quotaInfo.message || 'IndexedDB persistent storage enabled'}
            </span>
          </div>

          {/* 2. Safe Data Preservation Promise Callout */}
          <div style={{
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '14px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <ShieldCheck size={20} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.45' }}>
              <strong style={{ color: '#38bdf8' }}>Preserved Data Promise:</strong> Your saved vocabulary deck, flashcards, starred words, and study progress are <strong>never removed</strong> during cache or book cleanup.
            </div>
          </div>

          {/* 3. Translation Cache Management */}
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
                Translation Cache
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                {cacheCount > 0 ? `${cacheCount} cached word translations & synonyms` : 'Cache is clean'}
              </div>
            </div>

            <button
              onClick={handleClearCache}
              disabled={cacheCount === 0}
              style={{
                backgroundColor: cacheCount === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(217, 119, 6, 0.15)',
                border: cacheCount === 0 ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(217, 119, 6, 0.3)',
                color: cacheCount === 0 ? '#64748b' : '#d97706',
                borderRadius: '10px',
                padding: '8px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: cacheCount === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
            >
              <RefreshCw size={14} />
              <span>Clear Cache Only</span>
            </button>
          </div>

          {/* 4. Per-Book Storage Breakdown List */}
          <div>
            <div style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: '#94a3b8',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>Stored Books ({booksList.length})</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>IndexedDB Breakdown</span>
            </div>

            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                Calculating book storage sizes…
              </div>
            ) : booksList.length === 0 ? (
              <div style={{
                padding: '30px',
                textAlign: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px border-dashed rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                color: '#64748b',
                fontSize: '0.88rem'
              }}>
                No books stored in local memory.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {booksList.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        backgroundColor: b.type === 'pdf' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                        color: b.type === 'pdf' ? '#ef4444' : '#38bdf8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <FileText size={18} />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          color: '#f8fafc',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {b.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', gap: '8px' }}>
                          <span>{b.totalPages ? `${b.totalPages} Pages` : 'Text File'}</span>
                          <span>•</span>
                          <span>{b.uploadDate || 'Stored'}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                      <span style={{
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: '#d97706',
                        backgroundColor: 'rgba(217, 119, 6, 0.1)',
                        padding: '4px 10px',
                        borderRadius: '6px'
                      }}>
                        {b.displaySize}
                      </span>

                      <button
                        onClick={() => handleDeleteBook(b.id, b.title)}
                        disabled={deletingId === b.id}
                        title="Delete book from storage"
                        style={{
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          color: '#ef4444',
                          borderRadius: '8px',
                          padding: '6px 10px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.78rem',
                          fontWeight: 600
                        }}
                      >
                        <Trash2 size={14} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
