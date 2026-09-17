import React, { useState, useEffect } from 'react'
import { Volume2, Bookmark, BookmarkCheck, X, Copy, Check } from 'lucide-react'
import { translateWord, fetchSynonyms } from '../services/translationService'

export default function TranslationSlip({
  word,
  sourceLang = 'de',
  targetLang = 'en',
  sentenceContext = '',
  targetRect = null,
  fontSize = '1.1rem',
  isFavorite = false,
  onToggleFavorite,
  onClose
}) {
  const [loading, setLoading] = useState(true)
  const [translation, setTranslation] = useState('…')
  const [synonyms, setSynonyms] = useState([])
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [copied, setCopied] = useState(false)

  // Fetch translation & synonyms
  useEffect(() => {
    if (!word) return

    let isMounted = true
    setLoading(true)
    setTranslation('…')
    setSynonyms([])

    const loadData = async () => {
      // 1. Fetch translation (resolves first/independently)
      const transRes = await translateWord(word, sourceLang, targetLang, sentenceContext)
      if (isMounted) {
        setTranslation(transRes)
        setLoading(false)
      }

      // 2. Fetch synonyms in book's original language (sourceLang)
      try {
        const synRes = await fetchSynonyms(word, sourceLang, sentenceContext)
        if (isMounted) {
          setSynonyms(synRes)
        }
      } catch (e) {
        // Omit synonyms if unavailable
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [word, sourceLang, targetLang, sentenceContext])

  if (!word) return null

  // ── Pronunciation ─────────────────────────────────────────────────────────
  const handlePronounce = (e) => {
    e.stopPropagation()
    if (!('speechSynthesis' in window) || !word) return

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(word)
    const localeMap = {
      de: 'de-DE', fr: 'fr-FR', es: 'es-ES', en: 'en-US', it: 'it-IT',
      pt: 'pt-PT', ru: 'ru-RU', ur: 'ur-PK', ar: 'ar-SA', hi: 'hi-IN',
      tr: 'tr-TR', nl: 'nl-NL', zh: 'zh-CN', ja: 'ja-JP'
    }
    const fullLocale = localeMap[sourceLang] || 'de-DE'
    utterance.lang = fullLocale
    utterance.rate = 0.9

    const voices = window.speechSynthesis.getVoices()
    const matchingVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(sourceLang.toLowerCase()))
    if (matchingVoice) {
      utterance.voice = matchingVoice
    }

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  const handleCopy = (e) => {
    e.stopPropagation()
    const cleanTrans = (!translation || translation === '…' || translation === '...') ? word : `${word} — ${translation}`
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(cleanTrans).catch(() => {})
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const handleFavoriteClick = (e) => {
    e.stopPropagation()
    if (onToggleFavorite) {
      const cleanTrans = (!translation || translation === '…' || translation === '...') ? word : translation
      onToggleFavorite({
        word,
        translation: cleanTrans,
        synonyms,
        sourceLang,
        targetLang
      })
    }
  }

  // ── Size & Position (anchored to word, clamped to screen bounds) ───────────
  let positionStyle = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)'
  }

  if (targetRect) {
    const slipMaxWidth = 290
    const slipEstimatedHeight = 145
    let top = (targetRect.bottom || (targetRect.top + 20)) + 6
    let left = Math.max(12, (targetRect.left || (window.innerWidth / 2 - 145)) - 6)

    if (left + slipMaxWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - slipMaxWidth - 12)
    }

    // If popup would overflow bottom or hit the bottom pill, flip cleanly above
    if (top + slipEstimatedHeight > window.innerHeight - 80) {
      top = Math.max(60, targetRect.top - slipEstimatedHeight - 6)
    } else {
      top = Math.max(60, top)
    }

    positionStyle = {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`
    }
  }

  return (
    <>
      {/* Invisible backdrop to close on outside click */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'transparent',
          zIndex: 9998
        }}
      />

      {/* Floating translation slip popup */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...positionStyle,
          zIndex: 9999,
          width: 'max-content',
          minWidth: '220px',
          maxWidth: '290px',
          backgroundColor: '#181b26',
          color: '#f8fafc',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '10px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6), 0 4px 12px rgba(0, 0, 0, 0.4)',
          padding: '12px 14px',
          boxSizing: 'border-box',
          animation: 'fadeIn 0.15s ease-out'
        }}
      >
        {/* Header: Selected Word + Language Badge + Close */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          marginBottom: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
            <span style={{
              fontSize: '0.92rem',
              fontWeight: 700,
              color: '#f8fafc',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {word}
            </span>
            <span style={{
              fontSize: '0.62rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              color: '#94a3b8',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '1px 5px',
              borderRadius: '4px',
              flexShrink: 0
            }}>
              {sourceLang}
            </span>
          </div>

          <button
            onClick={onClose}
            title="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'color 0.15s ease'
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Translation Section */}
        <div style={{
          fontSize: '1.05rem',
          fontWeight: 600,
          color: '#60a5fa',
          lineHeight: 1.35,
          wordBreak: 'break-word',
          marginBottom: '8px'
        }}>
          {loading ? (
            <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>Translating…</span>
          ) : translation}
        </div>

        {/* Synonyms Section */}
        {!loading && synonyms && synonyms.length > 0 && (
          <div style={{
            marginBottom: '10px',
            fontSize: '0.74rem',
            lineHeight: 1.3,
            display: 'flex',
            alignItems: 'baseline',
            gap: '4px',
            overflow: 'hidden'
          }}>
            <span style={{ color: '#64748b', fontWeight: 500, flexShrink: 0 }}>Synonyms:</span>
            <span style={{ color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {synonyms.slice(0, 4).join(', ')}
            </span>
          </div>
        )}

        {/* Compact Bottom Action Bar: Pronounce | Copy | Save */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Pronounce Button */}
            <button
              onClick={handlePronounce}
              title="Pronounce word"
              style={{
                background: isSpeaking ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                border: isSpeaking ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isSpeaking ? '#60a5fa' : '#94a3b8',
                cursor: 'pointer',
                padding: 0,
                transition: 'all 0.15s ease'
              }}
            >
              <Volume2 size={13} />
            </button>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              title={copied ? 'Copied to clipboard' : 'Copy translation'}
              style={{
                background: copied ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                border: copied ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: copied ? '#34d399' : '#94a3b8',
                cursor: 'pointer',
                padding: 0,
                transition: 'all 0.15s ease'
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>

          {/* Save to Vocabulary Deck Button */}
          <button
            onClick={handleFavoriteClick}
            style={{
              background: isFavorite ? 'rgba(225, 29, 72, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: isFavorite ? '1px solid rgba(225, 29, 72, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              color: isFavorite ? '#f43f5e' : '#f8fafc',
              padding: '0 10px',
              height: '28px',
              fontSize: '0.74rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.15s ease'
            }}
          >
            {isFavorite ? (
              <>
                <BookmarkCheck size={12} />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Bookmark size={12} />
                <span>Save to Deck</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
