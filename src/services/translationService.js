import { logMobileDebug } from '../components/DebugOverlay'

// Translation, Synonyms & Pronunciation Pipeline

const GOOGLE_GTX_URL = 'https://translate.googleapis.com/translate_a/single'
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get'
const OPENTHESAURUS_DE_URL = 'https://www.openthesaurus.de/synonyme/search'
const DATAMUSE_URL = 'https://api.datamuse.com/words'

// In-memory + localStorage Caches
const translationCache = new Map()
const synonymCache = new Map()

// Helper to sanitize translation output
function sanitizeText(str) {
  if (!str) return ''
  return str
    .replace(/[\r\n\t\x00-\x1F\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── 1. Translation ─────────────────────────────────────────────────────────────

export async function translateWord(word, sourceLang = 'de', targetLang = 'en', sentenceContext = '') {
  if (!word || !word.trim()) return '—'

  const cleanWord = word.trim().replace(/^[^a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+|[^a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+$/g, '')
  if (!cleanWord) return '—'

  const cacheKey = `${cleanWord.toLowerCase()}_${sourceLang}_${targetLang}`
  if (translationCache.has(cacheKey)) {
    const cached = translationCache.get(cacheKey)
    logMobileDebug(`[TranslationService] ➔ Cache hit for "${cleanWord}": "${cached}"`)
    return cached
  }

  logMobileDebug(`[TranslationService] ➔ Translating word: "${cleanWord}" (${sourceLang} ➔ ${targetLang})`)

  // 1. Try Google GTX with auto source language detection (prevents language misclassification & MyMemory garbage fallback)
  try {
    const srcParam = (sourceLang && sourceLang !== targetLang) ? sourceLang : 'auto'
    const url = `${GOOGLE_GTX_URL}?client=gtx&sl=${srcParam}&tl=${targetLang}&dt=t&q=${encodeURIComponent(cleanWord)}`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      // data[0][0][0] is translated string
      if (data && data[0] && data[0][0] && data[0][0][0]) {
        const translated = sanitizeText(data[0][0][0])
        if (translated) {
          logMobileDebug(`[TranslationService] ✅ Google GTX Result for "${cleanWord}": "${translated}"`)
          translationCache.set(cacheKey, translated)
          return translated
        }
      }
    }
  } catch (err) {
    logMobileDebug(`⚠️ [TranslationService] Google GTX network error for "${cleanWord}": ${err.message}`)
  }

  // 2. Fallback: MyMemory free translation API
  try {
    const langpair = `${sourceLang === targetLang ? 'auto' : sourceLang}|${targetLang}`
    const url = `${MYMEMORY_URL}?q=${encodeURIComponent(cleanWord)}&langpair=${encodeURIComponent(langpair)}`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      const t = data?.responseData?.translatedText
      if (t && !t.includes('INVALID SOURCE') && !t.includes('PLEASE SELECT') && !t.includes('MYMEMORY')) {
        const translated = sanitizeText(t)
        if (translated && translated.toLowerCase() !== cleanWord.toLowerCase()) {
          logMobileDebug(`[TranslationService] MyMemory Result for "${cleanWord}": "${translated}"`)
          translationCache.set(cacheKey, translated)
          return translated
        }
      }
    }
  } catch (err) {
    logMobileDebug(`⚠️ [TranslationService] MyMemory failed: ${err.message}`)
  }

  // 3. Fallback: Return original clean word if translation fails
  return cleanWord
}

// ── 2. Synonyms in Original Book Language ──────────────────────────────────────

export async function fetchSynonyms(word, sourceLang = 'de', sentenceContext = '') {
  if (!word || !word.trim()) return []

  const cleanWord = word.trim().replace(/^[^a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+|[^a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+$/g, '')
  if (!cleanWord || cleanWord.length < 2) return []

  const cacheKey = `${cleanWord.toLowerCase()}_${sourceLang}`
  if (synonymCache.has(cacheKey)) {
    return synonymCache.get(cacheKey)
  }

  let synonyms = []

  // German Synonyms via OpenThesaurus
  if (sourceLang === 'de') {
    try {
      const url = `${OPENTHESAURUS_DE_URL}?q=${encodeURIComponent(cleanWord)}&format=application/json`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        const found = []
        for (const synset of (data.synsets || [])) {
          for (const term of (synset.terms || [])) {
            const t = sanitizeText(term.term)
            if (t && t.toLowerCase() !== cleanWord.toLowerCase() && !found.includes(t)) {
              found.push(t)
              if (found.length >= 3) break
            }
          }
          if (found.length >= 3) break
        }
        synonyms = found
      }
    } catch (e) {
      console.warn('[Synonyms] OpenThesaurus failed:', e)
    }
  }

  // English or general synonyms via Datamuse
  if (synonyms.length === 0) {
    try {
      const url = `${DATAMUSE_URL}?rel_syn=${encodeURIComponent(cleanWord)}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          synonyms = data
            .map(item => sanitizeText(item.word))
            .filter(w => w && w.toLowerCase() !== cleanWord.toLowerCase())
            .slice(0, 3)
        }
      }
    } catch (e) {
      console.warn('[Synonyms] Datamuse failed:', e)
    }
  }

  synonymCache.set(cacheKey, synonyms)
  return synonyms
}

// ── 3. Pronunciation (Web Speech API) ──────────────────────────────────────────

export function speakWord(word, langCode = 'de') {
  if (!('speechSynthesis' in window) || !word) return

  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(word)
  const fullLocale = getLocaleCode(langCode)
  utterance.lang = fullLocale
  utterance.rate = 0.9

  // Find matching native voice if available
  const voices = window.speechSynthesis.getVoices()
  const matchingVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(langCode.toLowerCase()))
  if (matchingVoice) {
    utterance.voice = matchingVoice
  }

  window.speechSynthesis.speak(utterance)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLocaleCode(langCode) {
  const map = {
    de: 'de-DE',
    fr: 'fr-FR',
    es: 'es-ES',
    en: 'en-US',
    it: 'it-IT',
    pt: 'pt-PT',
    ru: 'ru-RU',
    ur: 'ur-PK',
    ar: 'ar-SA',
    hi: 'hi-IN',
    tr: 'tr-TR',
    nl: 'nl-NL',
    zh: 'zh-CN',
    ja: 'ja-JP',
    ko: 'ko-KR'
  }
  return map[langCode] || 'de-DE'
}
