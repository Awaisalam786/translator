import React, { useState, useEffect } from 'react'
import { Volume2, Bookmark, BookmarkCheck, X } from 'lucide-react'
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

  // ── Size & Position (anchored to word bottom-left, clamped to screen bounds) ─
  let positionStyle = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)'
  }

  if (targetRect) {
    const slipMaxWidth = 310
    const slipEstimatedHeight = 160
    let top = (targetRect.bottom || (targetRect.top + 20)) + 8
    let left = Math.max(12, (targetRect.left || (window.innerWidth / 2 - 155)) - 10)

    if (left + slipMaxWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - slipMaxWidth - 12)
    }

    // If popup would overflow bottom of screen or hit the floating bottom pill, flip cleanly ABOVE the word
    if (top + slipEstimatedHeight > window.innerHeight - 85) {
      top = Math.max(60, targetRect.top - slipEstimatedHeight - 8)
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
          maxWidth: '310px',
          backgroundColor: '#161926',
          color: '#f8fafc',
          border: '1.5px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '12px',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.75)',
          padding: '12px 14px',
          boxSizing: 'border-box',
          animation: 'fadeIn 0.15s ease-out'
        }}
      >
        {/* Header: Original Tapped Word + Close button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          marginBottom: '6px',
          paddingBottom: '6px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              fontSize: '0.88rem',
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '0.02em'
            }}>
              {word}
            </span>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              padding: '2px 6px',
              borderRadius: '10px'
            }}>
              {sourceLang}
            </span>
          </div>

          <button
            onClick={onClose}
            title="Close"
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px'
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Translation text + Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          {/* Translation Result */}
          <div style={{
            fontSize: '1.15rem',
            fontWeight: 700,
            color: '#38bdf8',
            lineHeight: 1.3,
            wordBreak: 'break-word'
          }}>
            {loading ? (
              <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Translating…</span>
            ) : translation}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {/* Pronounce Button */}
            <button
              onClick={handlePronounce}
              title="Listen pronunciation"
              style={{
                background: isSpeaking ? '#f59e0b' : 'rgba(255, 255, 255, 0.08)',
                border: isSpeaking ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isSpeaking ? '#ffffff' : '#f59e0b',
                cursor: 'pointer',
                padding: 0,
                transition: 'background-color 0.15s ease'
              }}
            >
              <Volume2 size={15} />
            </button>

            {/* Quick Favorite Icon */}
            <button
              onClick={handleFavoriteClick}
              title={isFavorite ? 'Remove from Deck' : 'Add to Deck'}
              style={{
                background: isFavorite ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                border: isFavorite ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isFavorite ? '#fbbf24' : '#94a3b8',
                cursor: 'pointer',
                padding: 0
              }}
            >
              {isFavorite ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
            </button>
          </div>
        </div>

        {/* Synonyms line */}
        {!loading && synonyms && synonyms.length > 0 && (
          <div style={{
            marginTop: '8px',
            paddingTop: '6px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: '0.78rem',
            color: '#94a3b8',
            lineHeight: 1.3
          }}>
            <span style={{ fontWeight: 600, color: '#f59e0b' }}>Synonyms: </span>
            <span style={{ color: '#e2e8f0' }}>{synonyms.join(', ')}</span>
          </div>
        )}

        {/* Save to Vocabulary Deck button */}
        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button
            onClick={handleFavoriteClick}
            style={{
              width: '100%',
              padding: '7px 12px',
              borderRadius: '8px',
              border: isFavorite ? '1px solid rgba(245, 158, 11, 0.5)' : 'none',
              backgroundColor: isFavorite ? 'rgba(245, 158, 11, 0.2)' : 'var(--accent-gold)',
              background: isFavorite ? 'rgba(245, 158, 11, 0.2)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: isFavorite ? '#fbbf24' : '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              minHeight: '34px'
            }}
          >
            {isFavorite ? (
              <>
                <BookmarkCheck size={14} />
                <span>Saved in Vocabulary Deck</span>
              </>
            ) : (
              <>
                <Bookmark size={14} />
                <span>Save to Vocabulary Deck</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
