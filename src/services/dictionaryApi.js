// Smart Dictionary + Translation Service
// English: Free Dictionary API
// German synonyms: OpenThesaurus API (free, no key)
// Translations: MyMemory API (free, no key)

const EN_API        = 'https://api.dictionaryapi.dev/api/v2/entries/en/'
const THESAURUS_DE  = 'https://www.openthesaurus.de/synonyme/search'
const TRANSLATE_API = 'https://api.mymemory.translated.net/get'

const cache = new Map()
export const clearCache = () => cache.clear()

// ─── Language detection ───────────────────────────────────────────────────
export function detectLanguage(word) {
  if (/[äöüßÄÖÜ]/.test(word)) return 'de'
  return 'en'
}

// ─── MyMemory translation ─────────────────────────────────────────────────
export async function translateText(text, fromLang, toLang = 'en') {
  if (!text || fromLang === toLang) return text
  // MyMemory does not support 'auto' — skip if caller passes it
  if (fromLang === 'auto' || toLang === 'auto') return null
  try {
    const url = `${TRANSLATE_API}?q=${encodeURIComponent(text)}&langpair=${fromLang}|${toLang}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const t = data?.responseData?.translatedText
    // Filter out MyMemory error strings
    if (!t) return null
    if (t.includes('INVALID SOURCE') || t.includes('PLEASE SELECT')
        || t.includes('MYMEMORY') || t.startsWith("'")) return null
    // Strip carriage returns, newlines, and control characters (\r shows as &#x0D;)
    return t.replace(/[\r\n\t\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim()
  } catch (e) {
    console.warn('[translate]', e)
  }
  return null
}

// Alias for backward compatibility
export const translateWord = translateText

// ─── German synonyms via OpenThesaurus ───────────────────────────────────
async function getGermanSynonyms(word) {
  try {
    const url = `${THESAURUS_DE}?q=${encodeURIComponent(word)}&format=application/json`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    const syns = []
    for (const synset of (data.synsets || [])) {
      for (const term of (synset.terms || [])) {
        const t = term.term
        if (t && t.toLowerCase() !== word.toLowerCase() && !syns.includes(t)) {
          syns.push(t)
          if (syns.length >= 6) return syns
        }
      }
    }
    return syns
  } catch (e) {
    console.warn('[thesaurus DE]', e)
    return []
  }
}

// ─── Main word lookup ─────────────────────────────────────────────────────
export async function lookupWord(rawWord) {
  const word = rawWord.trim().replace(/["""„«»'']/g, '')
  if (!word || word.length < 2) return null

  const cacheKey = word.toLowerCase()
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  // ── Step 1: Try English Dictionary API ────────────────────────────────────
  try {
    const res = await fetch(`${EN_API}${encodeURIComponent(word.toLowerCase())}`)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        const entry    = data[0]
        const audioObj = entry.phonetics?.find(p => p.audio)
        const result   = {
          word: entry.word || word,
          sourceLang: 'en',
          language: 'English',
          phonetic: entry.phonetic || entry.phonetics?.[0]?.text || '',
          audioUrl: audioObj?.audio || '',
          nativeSynonyms: [], // English book → synonyms from dict
          meanings: entry.meanings.slice(0, 1).map(m => ({
            partOfSpeech: m.partOfSpeech,
            definitions: m.definitions.slice(0, 1).map(d => ({
              definition: d.definition,
              example: d.example || null
            })),
            synonyms: (m.synonyms || []).slice(0, 6)
          }))
        }
        // Use English synonyms from dict as nativeSynonyms
        result.nativeSynonyms = result.meanings.flatMap(m => m.synonyms).slice(0, 6)
        cache.set(cacheKey, result)
        return result
      }
    }
  } catch (e) {
    console.warn('[dict EN]', e)
  }

  // ── Step 2: Non-English word → translate to English ───────────────────────
  // Try German first (most common textbook language), then French, then Spanish
  let translated = await translateText(word, 'de', 'en')
  if (!translated || translated.toLowerCase() === word.toLowerCase()) {
    translated = await translateText(word, 'fr', 'en')
  }
  if (!translated || translated.toLowerCase() === word.toLowerCase()) {
    translated = await translateText(word, 'es', 'en')
  }

  const sourceLang = detectLanguage(word) // 'de' or 'en'

  // Fetch German synonyms in parallel with English definition lookup
  const [germanSynonyms, extraMeanings] = await Promise.all([
    // Always fetch German synonyms for the original word
    getGermanSynonyms(word),

    // Fetch English definitions for the translated word
    (async () => {
      if (!translated || translated.toLowerCase() === word.toLowerCase()) return []
      try {
        const firstWord = translated.split(/[\s,]/)[0].toLowerCase()
        const res = await fetch(`${EN_API}${encodeURIComponent(firstWord)}`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            return data[0].meanings.slice(0, 1).map(m => ({
              partOfSpeech: m.partOfSpeech,
              definitions: m.definitions.slice(0, 1).map(d => ({
                definition: d.definition,
                example: d.example || null
              })),
              synonyms: (m.synonyms || []).slice(0, 4)
            }))
          }
        }
      } catch (_) {}
      return []
    })()
  ])

  if (translated && translated.toLowerCase() !== word.toLowerCase()
      && !translated.startsWith('PLEASE SELECT')) {

    const result = {
      word,
      sourceLang,
      language: 'German → English',
      phonetic: '',
      audioUrl: '',
      translationEN: translated,
      // German synonyms from OpenThesaurus (shown in popup as native language synonyms)
      nativeSynonyms: germanSynonyms,
      meanings: extraMeanings.length > 0
        ? extraMeanings
        : [{
            partOfSpeech: 'translation',
            definitions: [{ definition: translated, example: null }],
            synonyms: []
          }]
    }
    cache.set(cacheKey, result)
    return result
  }

  // ── Step 3: Nothing found ─────────────────────────────────────────────────
  const fallback = {
    word,
    sourceLang: 'unknown',
    language: 'Unknown',
    phonetic: '',
    audioUrl: '',
    nativeSynonyms: [],
    meanings: [{
      partOfSpeech: 'not found',
      definitions: [{ definition: `No definition found for "${word}".`, example: null }],
      synonyms: []
    }]
  }
  cache.set(cacheKey, fallback)
  return fallback
}
