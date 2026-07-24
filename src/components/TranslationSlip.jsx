import React, { useState, useEffect } from 'react'
import { Volume2, Bookmark, BookmarkCheck } from 'lucide-react'
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
    const slipMaxWidth = 290
    const slipEstimatedHeight = 145
    let top = (targetRect.bottom || (targetRect.top + 20)) + 10
    let left = Math.max(16, (targetRect.left || (window.innerWidth / 2 - 145)) - 10)

    if (left + slipMaxWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - slipMaxWidth - 16)
    }

    // If popup would overflow bottom of screen, flip cleanly ABOVE the tapped word
    if (top + slipEstimatedHeight > window.innerHeight - 16) {
      top = Math.max(65, targetRect.top - slipEstimatedHeight - 10)
    } else {
      top = Math.max(65, top)
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
          zIndex: 200
        }}
      />

      {/* Small floating paper slip popup */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...positionStyle,
          zIndex: 210,
          width: 'max-content',
          maxWidth: '290px',
          backgroundColor: '#1e2230',
          color: '#f8fafc',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
          padding: '10px 14px',
          boxSizing: 'border-box'
        }}
      >
        {/* Row A & C: Translation text + Favorite + Mic button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          {/* Translation Text */}
          <div style={{
            fontSize: fontSize || '1.1rem',
            fontWeight: 600,
            color: '#38bdf8',
            lineHeight: 1.3,
            wordBreak: 'break-word'
          }}>
            {loading ? '…' : translation}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {/* Add to Deck / Favorite Button */}
            <button
              onClick={handleFavoriteClick}
              title={isFavorite ? 'Remove from Deck' : 'Add to Deck'}
              style={{
                background: isFavorite ? 'rgba(217, 119, 6, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                border: isFavorite ? '1px solid #d97706' : '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '50%',
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isFavorite ? '#fbbf24' : '#94a3b8',
                cursor: 'pointer',
                padding: 0
              }}
            >
              {isFavorite ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
            </button>

            {/* Mic / Pronounce Button */}
            <button
              onClick={handlePronounce}
              title="Listen pronunciation"
              style={{
                background: isSpeaking ? '#d97706' : 'rgba(255, 255, 255, 0.08)',
                border: isSpeaking ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '50%',
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isSpeaking ? '#ffffff' : '#f59e0b',
                cursor: 'pointer',
                padding: 0,
                transition: 'background-color 0.1s ease'
              }}
            >
              <Volume2 size={14} />
            </button>
          </div>
        </div>

        {/* Row B: Synonyms line */}
        {!loading && synonyms && synonyms.length > 0 && (
          <div style={{
            marginTop: '6px',
            paddingTop: '6px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: '0.78rem',
            color: '#94a3b8',
            lineHeight: 1.3
          }}>
            <span style={{ fontWeight: 600, color: '#cbd5e1' }}>Similar: </span>
            <span>{synonyms.join(', ')}</span>
          </div>
        )}

        {/* Row C: Prominent Save to Deck Button */}
        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button
            onClick={handleFavoriteClick}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: '6px',
              border: isFavorite ? '1px solid rgba(217, 119, 6, 0.4)' : 'none',
              backgroundColor: isFavorite ? 'rgba(217, 119, 6, 0.15)' : 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
              background: isFavorite ? 'rgba(217, 119, 6, 0.15)' : 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
              color: isFavorite ? '#fbbf24' : '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            {isFavorite ? (
              <>
                <BookmarkCheck size={14} />
                <span>Saved in Deck</span>
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
