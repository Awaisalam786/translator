import React, { useState } from 'react'
import { BookOpen, Key, Smartphone, ArrowRight, CheckCircle, AlertCircle, Send, ShieldCheck } from 'lucide-react'
import { validateKey, getPaymentSettings, submitPaymentProof } from '../services/licenseService'

const SESSION_KEY = 'leselampe_unlocked'

export default function PasswordLock({ children }) {
  // Always unlocked for direct access
  const [unlocked, setUnlocked] = useState(true)

  const [activeTab, setActiveTab] = useState('key') // 'key' or 'pay'
  const [keyInput, setKeyInput] = useState('')
  const [keyError, setKeyError] = useState(false)

  // Payment Form State
  const [phoneInput, setPhoneInput] = useState('')
  const [trxInput, setTrxInput] = useState('')
  const [provider, setProvider] = useState('JazzCash')
  const [submittedMsg, setSubmittedMsg] = useState(false)

  const paymentSettings = getPaymentSettings()

  const handleUnlockKey = (e) => {
    e.preventDefault()
    if (validateKey(keyInput)) {
      sessionStorage.setItem(SESSION_KEY, 'true')
      setUnlocked(true)
      setKeyError(false)
    } else {
      setKeyError(true)
    }
  }

  const handlePaymentSubmit = (e) => {
    e.preventDefault()
    if (phoneInput.trim() && trxInput.trim()) {
      submitPaymentProof({
        phone: phoneInput,
        trxId: trxInput,
        provider
      })
      setSubmittedMsg(true)
      setPhoneInput('')
      setTrxInput('')
    }
  }

  if (unlocked) {
    return <>{children}</>
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: '#12151e',
      color: '#e2e8f0',
      padding: '24px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        backgroundColor: '#1a1d2e',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '32px 24px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        boxSizing: 'border-box'
      }}>
        {/* App Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
            color: '#ffffff',
            marginBottom: '14px',
            boxShadow: '0 8px 20px rgba(217, 119, 6, 0.3)'
          }}>
            <BookOpen size={26} />
          </div>

          <h1 style={{
            fontFamily: '"Merriweather", "Georgia", serif',
            fontSize: '1.8rem',
            fontWeight: 700,
            color: '#f8fafc',
            margin: '0 0 4px 0',
            letterSpacing: '-0.02em'
          }}>
            Leselampe<span style={{ color: '#d97706' }}>.</span>
          </h1>

          <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
            Foreign Language Reader with Tap-to-Translate
          </p>
        </div>

        {/* ── Payment Account Info Card ────────────────────────────────────── */}
        <div style={{
          backgroundColor: '#12151e',
          borderRadius: '12px',
          border: '1px solid rgba(217, 119, 6, 0.3)',
          padding: '14px 16px',
          marginBottom: '20px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
            paddingBottom: '8px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: '#f59e0b', letterSpacing: '0.05em' }}>
              Payment Details
            </span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff', backgroundColor: 'rgba(217, 119, 6, 0.25)', padding: '2px 8px', borderRadius: '6px' }}>
              {paymentSettings.feeAmount}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.78rem' }}>
            {/* JazzCash */}
            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '8px', borderRadius: '8px' }}>
              <div style={{ color: '#ef4444', fontWeight: 700, marginBottom: '2px' }}>🔴 JazzCash</div>
              <div style={{ color: '#f8fafc', fontWeight: 600 }}>{paymentSettings.jazzcashNumber}</div>
              <div style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{paymentSettings.jazzcashTitle}</div>
            </div>

            {/* EasyPaisa */}
            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '8px', borderRadius: '8px' }}>
              <div style={{ color: '#10b981', fontWeight: 700, marginBottom: '2px' }}>🟢 EasyPaisa</div>
              <div style={{ color: '#f8fafc', fontWeight: 600 }}>{paymentSettings.easypaisaNumber}</div>
              <div style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{paymentSettings.easypaisaTitle}</div>
            </div>
          </div>
        </div>

        {/* ── Mode Tab Switcher ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            onClick={() => { setActiveTab('key'); setSubmittedMsg(false); }}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'key' ? '#d97706' : 'rgba(255, 255, 255, 0.06)',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Key size={14} />
            <span>Enter Access Key</span>
          </button>

          <button
            onClick={() => setActiveTab('pay')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'pay' ? '#d97706' : 'rgba(255, 255, 255, 0.06)',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Smartphone size={14} />
            <span>Submit TRX ID</span>
          </button>
        </div>

        {/* ── TAB 1: Enter Access Key Form ──────────────────────────────────── */}
        {activeTab === 'key' ? (
          <form onSubmit={handleUnlockKey} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              placeholder="e.g. LESE-xxxx-xxxx or passcode"
              value={keyInput}
              onChange={(e) => { setKeyInput(e.target.value); setKeyError(false); }}
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: keyError ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.12)',
                backgroundColor: '#12151e',
                color: '#f8fafc',
                fontSize: '0.9rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />

            {keyError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontSize: '0.8rem' }}>
                <AlertCircle size={14} />
                <span>Invalid or expired Access Key / Passcode.</span>
              </div>
            )}

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                color: '#ffffff',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(217, 119, 6, 0.3)'
              }}
            >
              <span>Unlock Reader</span>
              <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          /* ── TAB 2: Submit Payment Proof Form ────────────────────────────── */
          <form onSubmit={handlePaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {submittedMsg ? (
              <div style={{
                textAlign: 'center',
                padding: '16px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '10px',
                color: '#10b981'
              }}>
                <CheckCircle size={28} style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>Payment Submitted!</div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' }}>
                  Your payment has been sent to admin for verification. You will receive your Access Key shortly.
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <label style={{ flex: 1, fontSize: '0.75rem', color: '#94a3b8' }}>
                    Payment Account:
                    <select
                      value={provider}
                      onChange={e => setProvider(e.target.value)}
                      style={{
                        width: '100%', padding: '8px', marginTop: '4px',
                        borderRadius: '6px', backgroundColor: '#12151e',
                        border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc', outline: 'none'
                      }}
                    >
                      <option value="JazzCash">🔴 JazzCash</option>
                      <option value="EasyPaisa">🟢 EasyPaisa</option>
                    </select>
                  </label>

                  <label style={{ flex: 1, fontSize: '0.75rem', color: '#94a3b8' }}>
                    Your Mobile Number:
                    <input
                      type="text"
                      placeholder="03xx-xxxxxxx"
                      value={phoneInput}
                      onChange={e => setPhoneInput(e.target.value)}
                      required
                      style={{
                        width: '100%', padding: '8px', marginTop: '4px',
                        borderRadius: '6px', backgroundColor: '#12151e',
                        border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc', outline: 'none', boxSizing: 'border-box'
                      }}
                    />
                  </label>
                </div>

                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Transaction ID (TRX ID):
                  <input
                    type="text"
                    placeholder="e.g. 1092837482"
                    value={trxInput}
                    onChange={e => setTrxInput(e.target.value)}
                    required
                    style={{
                      width: '100%', padding: '8px 12px', marginTop: '4px',
                      borderRadius: '6px', backgroundColor: '#12151e',
                      border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </label>

                <button
                  type="submit"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    marginTop: '4px'
                  }}
                >
                  <Send size={15} />
                  <span>Submit Payment for Approval</span>
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
