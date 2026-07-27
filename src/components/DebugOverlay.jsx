import React, { useState, useEffect } from 'react'
import { Bug, X, Trash2, Copy, Check } from 'lucide-react'

// Global log bus for mobile diagnostics
if (!window.__debugLogs) {
  window.__debugLogs = []
}

export function logMobileDebug(msg, data = null) {
  const timestamp = new Date().toLocaleTimeString()
  const logStr = data ? `[${timestamp}] ${msg} ${JSON.stringify(data)}` : `[${timestamp}] ${msg}`
  window.__debugLogs.push(logStr)
  console.log('[MobileTrace]', msg, data || '')
  if (window.__refreshDebugOverlay) {
    window.__refreshDebugOverlay()
  }
}

// Intercept console.error and console.warn for mobile UI display
const origConsoleError = console.error
console.error = function (...args) {
  origConsoleError.apply(console, args)
  logMobileDebug(`❌ ERROR: ${args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')}`)
}

const origConsoleWarn = console.warn
console.warn = function (...args) {
  origConsoleWarn.apply(console, args)
  logMobileDebug(`⚠️ WARN: ${args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')}`)
}

export default function DebugOverlay() {
  const [isOpen, setIsOpen] = useState(false)
  const [logs, setLogs] = useState([...window.__debugLogs])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    window.__refreshDebugOverlay = () => {
      setLogs([...window.__debugLogs])
    }
    logMobileDebug('🐞 Mobile Diagnostics initialized')
  }, [])

  const handleCopyLogs = () => {
    const text = logs.join('\n')
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {})
  }

  const handleClearLogs = () => {
    window.__debugLogs = []
    setLogs([])
  }

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        title="Mobile Diagnostics Logs"
        style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          zIndex: 9999,
          backgroundColor: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '30px',
          color: '#38bdf8',
          padding: '6px 12px',
          fontSize: '0.75rem',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)'
        }}
      >
        <Bug size={14} color="#38bdf8" />
        <span>Diagnostics ({logs.length})</span>
      </button>

      {/* Slide-Up Drawer */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          padding: '16px',
          boxSizing: 'border-box'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            paddingBottom: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bug size={20} color="#38bdf8" />
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc', fontWeight: 700 }}>
                Mobile Diagnostic Logs
              </h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={handleCopyLogs}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '6px 10px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={handleClearLogs}
                style={{
                  background: 'rgba(239,68,68,0.2)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#ef4444',
                  padding: '6px 10px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Trash2 size={14} />
                <span>Clear</span>
              </button>

              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '30px',
                  height: '30px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Logs Terminal Window */}
          <div style={{
            flex: 1,
            backgroundColor: '#090d16',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '14px',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.76rem',
            color: '#38bdf8',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            lineHeight: 1.5
          }}>
            {logs.length === 0 ? (
              <div style={{ color: '#64748b' }}>No logs recorded yet. Try uploading a book file to see diagnostic events.</div>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  style={{
                    color: log.includes('❌') ? '#ef4444' : log.includes('⚠️') ? '#f59e0b' : '#38bdf8',
                    marginBottom: '6px'
                  }}
                >
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}
