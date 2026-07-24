// Language Detector Service (client-side, free public endpoints + pattern fallback)

export const LANGUAGE_NAMES = {
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  en: 'English',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  ur: 'Urdu',
  ar: 'Arabic',
  hi: 'Hindi',
  tr: 'Turkish',
  nl: 'Dutch',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean'
}

/**
 * Detect language of a text snippet (e.g. first page or paragraphs)
 */
export async function detectLanguage(textSnippet) {
  if (!textSnippet || typeof textSnippet !== 'string') {
    return { code: 'de', name: 'German' }
  }

  const cleanSample = textSnippet.trim().slice(0, 1000)
  if (cleanSample.length < 10) {
    return { code: 'de', name: 'German' }
  }

  // 1. Primary: Google GTX public auto-detection endpoint
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(cleanSample.slice(0, 200))}`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      // data[2] is detected source language code, e.g. "de", "fr", "es"
      if (data && data[2] && typeof data[2] === 'string') {
        const code = data[2].toLowerCase().split('-')[0]
        const name = LANGUAGE_NAMES[code] || code.toUpperCase()
        return { code, name }
      }
    }
  } catch (err) {
    console.warn('[LangDetector] Google GTX detect failed, trying pattern matching fallback:', err)
  }

  // 2. Pattern matching fallback
  const code = patternDetect(cleanSample)
  const name = LANGUAGE_NAMES[code] || 'German'
  return { code, name }
}

function patternDetect(text) {
  // Script / Character set checks
  if (/[\u0600-\u06FF]/.test(text)) return 'ur' // Arabic/Urdu
  if (/[\u0900-\u097F]/.test(text)) return 'hi' // Hindi/Devanagari
  if (/[\u0400-\u04FF]/.test(text)) return 'ru' // Russian/Cyrillic
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh' // Chinese
  if (/[\u3040-\u30FF]/.test(text)) return 'ja' // Japanese

  // Specific Latin character markers
  const deScore = (text.match(/[äöüßÄÖÜ]/g) || []).length
  const frScore = (text.match(/[éèàâêîôûùçœÉÈÀÂÊÎÔÛÙÇ]/g) || []).length
  const esScore = (text.match(/[ñáéíóú¿¡ÑÁÉÍÓÚ]/g) || []).length
  const itScore = (text.match(/[àèéìíîòóùúÀÈÉÌÍÎÒÓÙÚ]/g) || []).length
  const ptScore = (text.match(/[ãõçáéíóúâêôÃÕÇ]/g) || []).length

  if (deScore > 2 && deScore >= frScore && deScore >= esScore) return 'de'
  if (frScore > 2 && frScore >= deScore && frScore >= esScore) return 'fr'
  if (esScore > 2 && esScore >= deScore && esScore >= frScore) return 'es'
  if (ptScore > 2) return 'pt'
  if (itScore > 2) return 'it'

  // Word frequency heuristics for common European languages
  const lower = text.toLowerCase()
  const deWords = (lower.match(/\b(der|die|das|und|ist|nicht|mit|ein|eine|den|zu|auf|für)\b/g) || []).length
  const frWords = (lower.match(/\b(le|la|les|un|une|et|est|pas|pour|dans|que|sur)\b/g) || []).length
  const esWords = (lower.match(/\b(el|la|los|las|un|una|y|es|no|por|para|con|en)\b/g) || []).length
  const enWords = (lower.match(/\b(the|and|is|in|it|you|that|was|for|on|are|with)\b/g) || []).length

  const scores = [
    { code: 'de', count: deWords },
    { code: 'fr', count: frWords },
    { code: 'es', count: esWords },
    { code: 'en', count: enWords }
  ]

  scores.sort((a, b) => b.count - a.count)
  if (scores[0].count > 3) {
    return scores[0].code
  }

  // Default fallback
  return 'de'
}
