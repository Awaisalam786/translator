import React, { useState, useEffect } from 'react'
import { X, Shield, HardDrive, BookOpen, Bookmark, Trash2, Download, RefreshCw, Key, CheckCircle, AlertTriangle, Smartphone, Copy, Check } from 'lucide-react'
import { getBooksMetadata, deleteBookComplete, getStorageStatus } from '../services/storageService'
import {
  getPaymentSettings, savePaymentSettings,
  getActivationKeys, generateActivationKey, deleteActivationKey,
  getPaymentSubmissions, approveSubmission, rejectSubmission
} from '../services/licenseService'

export default function AdminPanelModal({
  savedWords = [],
  onClose,
  onRefreshData,
  onClearDeck
}) {
  const [adminPassword, setAdminPassword] = useState('')
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return sessionStorage.getItem('leselampe_admin_authenticated') === 'true'
  })
  const [authError, setAuthError] = useState(false)

  const [activeTab, setActiveTab] = useState('overview') // 'overview', 'payments', 'keys', 'books', 'deck', 'settings'
  const [books, setBooks] = useState([])
  const [storageInfo, setStorageInfo] = useState(null)

  // License & Payment States
  const [paymentSettings, setPaymentSettingsState] = useState(getPaymentSettings)
  const [keysList, setKeysList] = useState(getActivationKeys)
  const [submissions, setSubmissions] = useState(getPaymentSubmissions)
  const [copiedKey, setCopiedKey] = useState('')
  const [settingsSavedMsg, setSettingsSavedMsg] = useState(false)

  useEffect(() => {
    if (isAdminAuthenticated) {
      loadAdminData()
    }
  }, [isAdminAuthenticated])

  const loadAdminData = async () => {
    const bList = getBooksMetadata()
    setBooks(bList)
    const sStatus = await getStorageStatus()
    setStorageInfo(sStatus)
    setKeysList(getActivationKeys())
    setSubmissions(getPaymentSubmissions())
  }

  const handleAdminLogin = (e) => {
    e.preventDefault()
    if (adminPassword.trim() === 'awaisalam' || adminPassword.trim() === 'admin123') {
      sessionStorage.setItem('leselampe_admin_authenticated', 'true')
      setIsAdminAuthenticated(true)
      setAuthError(false)
    } else {
      setAuthError(true)
    }
  }

  // Generate Key
  const handleGenerateKey = (type) => {
    generateActivationKey(type)
    setKeysList(getActivationKeys())
  }

  const handleCopyKey = (code) => {
    navigator.clipboard.writeText(code)
    setCopiedKey(code)
    setTimeout(() => setCopiedKey(''), 2500)
  }

  const handleDeleteKey = (code) => {
    deleteActivationKey(code)
    setKeysList(getActivationKeys())
  }

  // Payment Submission Actions
  const handleApproveSubmission = (id) => {
    approveSubmission(id)
    setSubmissions(getPaymentSubmissions())
    setKeysList(getActivationKeys())
  }

  const handleRejectSubmission = (id) => {
    rejectSubmission(id)
    setSubmissions(getPaymentSubmissions())
  }

  // Update Payment Details
  const handleSavePaymentDetails = (e) => {
    e.preventDefault()
    savePaymentSettings(paymentSettings)
    setSettingsSavedMsg(true)
    setTimeout(() => setSettingsSavedMsg(false), 3000)
  }

  const handleDeleteBook = async (bookId, title) => {
    if (window.confirm(`Admin action: Delete "${title}" from storage?`)) {
      await deleteBookComplete(bookId)
      await loadAdminData()
      onRefreshData?.()
    }
  }

  const handleExportVocabularyCSV = () => {
    if (savedWords.length === 0) return
    const headers = ['Word', 'Translation', 'Similar Synonyms', 'Source Language', 'Target Language', 'Date Added']
    const rows = savedWords.map(w => [
      `"${w.word}"`,
      `"${w.translation || ''}"`,
      `"${(w.synonyms || []).join('; ')}"`,
      `"${w.sourceLang || ''}"`,
      `"${w.targetLang || ''}"`,
      `"${w.dateAdded || ''}"`
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Leselampe_Vocabulary_Export_${Date.now()}.csv`
    link.click()
  }

  // ── Render Admin Auth Screen if locked ─────────────────────────────────────
  if (!isAdminAuthenticated) {
    return (
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(5px)', zIndex: 300, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: '380px', backgroundColor: '#1a1d2e',
            color: '#f8fafc', border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px', padding: '28px', textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
          }}
        >
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            backgroundColor: 'rgba(217, 119, 6, 0.2)', color: '#f59e0b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <Shield size={24} />
          </div>

          <h2 style={{ fontFamily: '"Merriweather", serif', fontSize: '1.25rem', fontWeight: 700, margin: '0 0 6px 0' }}>
            Admin Panel Access
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 20px 0' }}>
            Enter admin passcode (`awaisalam`) to open control panel.
          </p>

          <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="password"
              placeholder="Admin password"
              value={adminPassword}
              onChange={e => { setAdminPassword(e.target.value); setAuthError(false); }}
              autoFocus
              style={{
                padding: '10px 14px', borderRadius: '8px',
                backgroundColor: '#12151e', border: authError ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.12)',
                color: '#f8fafc', fontSize: '0.9rem', outline: 'none'
              }}
            />
            {authError && (
              <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>
                Incorrect admin password.
              </span>
            )}
            <button
              type="submit"
              style={{
                padding: '10px', borderRadius: '8px', border: 'none',
                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                color: '#ffffff', fontWeight: 600, cursor: 'pointer'
              }}
            >
              Access Admin Panel
            </button>
          </form>
        </div>
      </div>
    )
  }

  const pendingSubmissionsCount = submissions.filter(s => s.status === 'Pending').length

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)', zIndex: 300, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '20px'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '780px', backgroundColor: '#1a1d2e',
          color: '#f8fafc', border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          padding: '24px', boxSizing: 'border-box', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff'
            }}>
              <Shield size={22} />
            </div>
            <div>
              <h2 style={{ fontFamily: '"Merriweather", serif', fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                Admin Control Panel
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
                Payments, Activation Keys, Books Catalog, & Settings
              </p>
            </div>
          </div>

          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '6px 12px', borderRadius: '6px', border: 'none',
              backgroundColor: activeTab === 'overview' ? '#d97706' : 'rgba(255,255,255,0.06)',
              color: '#ffffff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Dashboard
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            style={{
              padding: '6px 12px', borderRadius: '6px', border: 'none',
              backgroundColor: activeTab === 'payments' ? '#d97706' : 'rgba(255,255,255,0.06)',
              color: '#ffffff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            <span>Pending Payments</span>
            {pendingSubmissionsCount > 0 && (
              <span style={{ backgroundColor: '#ef4444', color: '#fff', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px' }}>
                {pendingSubmissionsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('keys')}
            style={{
              padding: '6px 12px', borderRadius: '6px', border: 'none',
              backgroundColor: activeTab === 'keys' ? '#d97706' : 'rgba(255,255,255,0.06)',
              color: '#ffffff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Keys Generator ({keysList.length})
          </button>

          <button
            onClick={() => setActiveTab('books')}
            style={{
              padding: '6px 12px', borderRadius: '6px', border: 'none',
              backgroundColor: activeTab === 'books' ? '#d97706' : 'rgba(255,255,255,0.06)',
              color: '#ffffff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Books ({books.length})
          </button>

          <button
            onClick={() => setActiveTab('deck')}
            style={{
              padding: '6px 12px', borderRadius: '6px', border: 'none',
              backgroundColor: activeTab === 'deck' ? '#d97706' : 'rgba(255,255,255,0.06)',
              color: '#ffffff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Vocabulary ({savedWords.length})
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            style={{
              padding: '6px 12px', borderRadius: '6px', border: 'none',
              backgroundColor: activeTab === 'settings' ? '#d97706' : 'rgba(255,255,255,0.06)',
              color: '#ffffff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Payment Settings
          </button>
        </div>

        {/* ── TAB 1: System Dashboard ────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
              <div style={{ backgroundColor: '#12151e', borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginBottom: '4px' }}>Pending Payments</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: pendingSubmissionsCount > 0 ? '#f59e0b' : '#f8fafc' }}>
                  {pendingSubmissionsCount}
                </div>
              </div>

              <div style={{ backgroundColor: '#12151e', borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginBottom: '4px' }}>Generated Keys</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc' }}>{keysList.length}</div>
              </div>

              <div style={{ backgroundColor: '#12151e', borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginBottom: '4px' }}>Total Books</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc' }}>{books.length}</div>
              </div>

              <div style={{ backgroundColor: '#12151e', borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginBottom: '4px' }}>Storage Engine</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>{storageInfo?.mode || 'IndexedDB'}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: Pending Payments & TRX Submissions ────────────────────────── */}
        {activeTab === 'payments' && (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {submissions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No payment submissions yet.</div>
            ) : (
              submissions.map(sub => (
                <div
                  key={sub.id}
                  style={{
                    backgroundColor: '#12151e', borderRadius: '10px', padding: '12px 16px',
                    border: '1px solid rgba(255,255,255,0.08)', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between', gap: '12px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, color: sub.provider === 'JazzCash' ? '#ef4444' : '#10b981' }}>
                        {sub.provider}
                      </span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc' }}>
                        {sub.phone}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({sub.submittedAt})</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#38bdf8', marginTop: '4px', fontFamily: 'monospace' }}>
                      TRX ID: {sub.trxId}
                    </div>
                    {sub.generatedKey && (
                      <div style={{ fontSize: '0.78rem', color: '#10b981', marginTop: '2px' }}>
                        Approved Key: <strong>{sub.generatedKey}</strong>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    {sub.status === 'Pending' ? (
                      <>
                        <button
                          onClick={() => handleApproveSubmission(sub.id)}
                          style={{
                            padding: '6px 12px', borderRadius: '6px', border: 'none',
                            backgroundColor: '#10b981', color: '#fff', fontSize: '0.8rem',
                            fontWeight: 600, cursor: 'pointer'
                          }}
                        >
                          Approve & Key
                        </button>
                        <button
                          onClick={() => handleRejectSubmission(sub.id)}
                          style={{
                            padding: '6px 12px', borderRadius: '6px', border: 'none',
                            backgroundColor: '#ef4444', color: '#fff', fontSize: '0.8rem',
                            fontWeight: 600, cursor: 'pointer'
                          }}
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span style={{
                        fontSize: '0.8rem', fontWeight: 700, padding: '4px 8px', borderRadius: '4px',
                        backgroundColor: sub.status === 'Approved' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: sub.status === 'Approved' ? '#10b981' : '#ef4444'
                      }}>
                        {sub.status}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── TAB 3: Access Keys Generator ───────────────────────────────────── */}
        {activeTab === 'keys' && (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Generate Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => handleGenerateKey('1 Month')}
                style={{
                  flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                  backgroundColor: '#d97706', color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer'
                }}
              >
                + Generate 1-Month Key
              </button>

              <button
                onClick={() => handleGenerateKey('6 Months')}
                style={{
                  flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                  backgroundColor: '#d97706', color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer'
                }}
              >
                + Generate 6-Month Key
              </button>

              <button
                onClick={() => handleGenerateKey('Lifetime')}
                style={{
                  flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                  backgroundColor: '#10b981', color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer'
                }}
              >
                + Generate Lifetime Key
              </button>
            </div>

            {/* Keys Table */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {keysList.map((k, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#12151e', borderRadius: '8px', padding: '10px 14px',
                    border: '1px solid rgba(255,255,255,0.08)', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <span style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                      {k.code}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '10px' }}>
                      ({k.type})
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => handleCopyKey(k.code)}
                      style={{
                        padding: '4px 10px', borderRadius: '6px', border: 'none',
                        backgroundColor: copiedKey === k.code ? '#10b981' : 'rgba(255,255,255,0.1)',
                        color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      {copiedKey === k.code ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedKey === k.code ? 'Copied' : 'Copy'}</span>
                    </button>

                    {k.code !== 'LESE-DEMO-VIP' && (
                      <button
                        onClick={() => handleDeleteKey(k.code)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 4: Books Catalog ───────────────────────────────────────────── */}
        {activeTab === 'books' && (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {books.map(b => (
              <div
                key={b.id}
                style={{
                  backgroundColor: '#12151e', borderRadius: '10px', padding: '12px 16px',
                  border: '1px solid rgba(255,255,255,0.08)', display: 'flex',
                  alignItems: 'center', justifyContent: 'space-between', gap: '12px'
                }}
              >
                <div>
                  <div style={{ fontFamily: '"Merriweather", serif', fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                    {b.title}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                    Type: <strong style={{ color: '#d97706' }}>{b.type?.toUpperCase()}</strong> · Lang: {b.sourceLangName || 'German'} · Pages: {b.totalPages}
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteBook(b.id, b.title)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)', border: 'none', borderRadius: '6px',
                    color: '#ef4444', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB 5: Vocabulary Export ───────────────────────────────────────── */}
        {activeTab === 'deck' && (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Total Saved Items: {savedWords.length}
              </span>

              <button
                onClick={handleExportVocabularyCSV}
                disabled={savedWords.length === 0}
                style={{
                  background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '6px', color: '#38bdf8', padding: '6px 12px', fontSize: '0.8rem',
                  fontWeight: 600, cursor: savedWords.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Download size={14} /> Export CSV
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {savedWords.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#12151e', borderRadius: '8px', padding: '10px 14px',
                    border: '1px solid rgba(255,255,255,0.08)', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <span style={{ fontFamily: '"Merriweather", serif', fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                      {item.word}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: '#38bdf8', marginLeft: '10px', fontWeight: 600 }}>
                      → {item.translation}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 6: Payment Settings Form ──────────────────────────────────── */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSavePaymentDetails} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
              Edit JazzCash & EasyPaisa Payment Accounts
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* JazzCash Number */}
              <label style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                🔴 JazzCash Account Number:
                <input
                  type="text"
                  value={paymentSettings.jazzcashNumber}
                  onChange={e => setPaymentSettingsState({ ...paymentSettings, jazzcashNumber: e.target.value })}
                  style={{
                    width: '100%', padding: '8px 12px', marginTop: '4px', borderRadius: '6px',
                    backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#f8fafc', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </label>

              {/* JazzCash Title */}
              <label style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                JazzCash Account Title:
                <input
                  type="text"
                  value={paymentSettings.jazzcashTitle}
                  onChange={e => setPaymentSettingsState({ ...paymentSettings, jazzcashTitle: e.target.value })}
                  style={{
                    width: '100%', padding: '8px 12px', marginTop: '4px', borderRadius: '6px',
                    backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#f8fafc', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </label>

              {/* EasyPaisa Number */}
              <label style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                🟢 EasyPaisa Account Number:
                <input
                  type="text"
                  value={paymentSettings.easypaisaNumber}
                  onChange={e => setPaymentSettingsState({ ...paymentSettings, easypaisaNumber: e.target.value })}
                  style={{
                    width: '100%', padding: '8px 12px', marginTop: '4px', borderRadius: '6px',
                    backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#f8fafc', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </label>

              {/* EasyPaisa Title */}
              <label style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                EasyPaisa Account Title:
                <input
                  type="text"
                  value={paymentSettings.easypaisaTitle}
                  onChange={e => setPaymentSettingsState({ ...paymentSettings, easypaisaTitle: e.target.value })}
                  style={{
                    width: '100%', padding: '8px 12px', marginTop: '4px', borderRadius: '6px',
                    backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#f8fafc', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </label>
            </div>

            {/* Subscription Fee Display */}
            <label style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Displayed Subscription Fee Amount:
              <input
                type="text"
                value={paymentSettings.feeAmount}
                onChange={e => setPaymentSettingsState({ ...paymentSettings, feeAmount: e.target.value })}
                style={{
                  width: '100%', padding: '8px 12px', marginTop: '4px', borderRadius: '6px',
                  backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#f8fafc', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </label>

            <button
              type="submit"
              style={{
                padding: '10px', borderRadius: '8px', border: 'none',
                backgroundColor: '#d97706', color: '#ffffff', fontWeight: 600, cursor: 'pointer'
              }}
            >
              Save Payment Settings
            </button>

            {settingsSavedMsg && (
              <div style={{ color: '#10b981', fontSize: '0.8rem', textAlign: 'center' }}>
                ✓ Payment settings saved successfully! They will now display on the payment gate screen.
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
