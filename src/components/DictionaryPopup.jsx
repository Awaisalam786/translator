import React, { useState, useEffect } from 'react'
import { X, Volume2, Bookmark, BookmarkCheck, Globe } from 'lucide-react'
import { lookupWord, translateText } from '../services/dictionaryApi'

export default function DictionaryPopup({ word, onClose, onSaveVocabulary, isSaved }) {
  const [loading,      setLoading]      = useState(true)
  const [dictData,     setDictData]     = useState(null)
  const [targetLang,   setTargetLang]   = useState('en')
  // translated definitions in the selected language
  const [translatedDefs, setTranslatedDefs] = useState([])
  const [transLoading, setTransLoading]    = useState(false)

  // ── Load definition on word change ───────────────────────────────────────
  useEffect(() => {
    if (!word) return
    let alive = true
    setLoading(true)
    setDictData(null)
    setTargetLang('en')
    setTranslatedDefs([])
    lookupWord(word).then(d => {
      if (alive) { setDictData(d); setLoading(false) }
    })
    return () => { alive = false }
  }, [word])

  // ── Audio playback ───────────────────────────────────────────────────────
  const playAudio = () => {
    if (dictData?.audioUrl) {
      new Audio(dictData.audioUrl).play().catch(speak)
    } else speak()
  }
  const speak = () => {
    window.speechSynthesis?.cancel()
    const u = new SpeechSynthesisUtterance(word)
    u.rate = 0.9
    window.speechSynthesis?.speak(u)
  }

  // ── Translate definitions to selected language ────────────────────────────
  const handleLangChange = async (lang) => {
    setTargetLang(lang)
    setTranslatedDefs([])
    if (lang === 'en' || !dictData) return

    setTransLoading(true)
    const firstMeaning = dictData.meanings?.[0]
    if (!firstMeaning?.definitions?.length) { setTransLoading(false); return }

    // Translate up to 2 definitions
    const defs = firstMeaning.definitions.slice(0, 1)
    const results = await Promise.all(
      defs.map(async def => {
        const translated = await translateText(def.definition, 'en', lang)
        return { ...def, definition: translated || def.definition }
      })
    )
    setTranslatedDefs(results)
    setTransLoading(false)
  }

  if (!word) return null

  const firstMeaning = dictData?.meanings?.[0]
  // Show translated definitions if available, else English originals
  const displayDefs  = translatedDefs.length > 0
    ? translatedDefs
    : firstMeaning?.definitions?.slice(0, 1) || []

  // Synonyms: prefer native-language synonyms (German etc), fallback to English
  const synonyms = dictData?.nativeSynonyms?.length > 0
    ? dictData.nativeSynonyms
    : (firstMeaning?.synonyms || [])

  const langLabel = dictData?.nativeSynonyms?.length > 0
    ? (dictData.sourceLang === 'de' ? 'DE' : dictData.sourceLang?.toUpperCase())
    : 'EN'

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:110
      }} />

      {/* ── Compact popup card ── */}
      <div onClick={e => e.stopPropagation()} style={{
        position:'fixed',
        top:'50%', left:'50%',
        transform:'translate(-50%,-50%)',
        zIndex:120,
        width:'min(95vw, 340px)',
        background:'var(--glass-bg)',
        backdropFilter:'blur(20px)',
        border:'1px solid var(--glass-border)',
        borderRadius:'12px',
        boxShadow:'0 10px 36px rgba(0,0,0,0.5)',
        overflow:'hidden',
        animation:'_pop .17s cubic-bezier(0.34,1.56,0.64,1)'
      }}>
        <style>{`@keyframes _pop{from{opacity:0;transform:translate(-50%,-50%) scale(.84)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}`}</style>

        {/* ── Header ── */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'9px 12px 7px', borderBottom:'1px solid var(--border-color)'
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
            <span style={{ fontSize:'1.15rem', fontWeight:800, color:'var(--text-primary)',
              fontFamily:'var(--font-display)' }}>{word}</span>
            {dictData?.phonetic && (
              <span style={{ fontSize:'0.72rem', color:'var(--text-secondary)',
                fontFamily:'var(--font-mono)' }}>{dictData.phonetic}</span>
            )}
            <button onClick={playAudio} style={{
              background:'var(--accent-light)', border:'none', borderRadius:'50%',
              width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center',
              cursor:'pointer', color:'var(--accent-primary)', flexShrink:0
            }}>
              <Volume2 size={11} />
            </button>
            {dictData?.language && dictData.language !== 'English' && (
              <span style={{ fontSize:'0.62rem', background:'#d97706', color:'#fff',
                padding:'1px 6px', borderRadius:7, fontWeight:700 }}>
                {dictData.language}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none',
            color:'var(--text-muted)', cursor:'pointer', padding:2, flexShrink:0 }}>
            <X size={15} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding:'8px 12px', maxHeight:'52vh', overflowY:'auto' }}>
          {loading ? (
            <div style={{ fontSize:'0.82rem', color:'var(--text-muted)', padding:'6px 0' }}>
              Looking up…
            </div>
          ) : (
            <>
              {/* EN translation banner for non-English words */}
              {dictData?.translationEN && (
                <div style={{
                  background:'var(--accent-light)', borderRadius:7,
                  padding:'4px 10px', marginBottom:7,
                  display:'flex', alignItems:'center', gap:5
                }}>
                  <span style={{ fontSize:'0.68rem', color:'var(--text-muted)', fontWeight:700 }}>EN</span>
                  <span style={{ fontSize:'0.92rem', fontWeight:800, color:'var(--accent-primary)' }}>
                    {dictData.translationEN}
                  </span>
                </div>
              )}

              {/* Part of speech */}
              {firstMeaning && (
                <span style={{
                  display:'inline-block', fontSize:'0.62rem', fontWeight:700,
                  letterSpacing:'0.7px', textTransform:'uppercase',
                  color:'var(--accent-primary)', background:'var(--accent-light)',
                  padding:'1px 7px', borderRadius:6, marginBottom:6
                }}>
                  {firstMeaning.partOfSpeech}
                </span>
              )}

              {/* Definitions (translated if user selected a language) */}
              {transLoading ? (
                <div style={{ fontSize:'0.8rem', color:'var(--text-muted)', padding:'4px 0' }}>
                  Translating…
                </div>
              ) : displayDefs.map((def, i) => (
                <div key={i} style={{ marginBottom:6 }}>
                  <div style={{ fontSize:'0.82rem', color:'var(--text-primary)', lineHeight:1.45 }}>
                    <span>{def.definition}</span>
                  </div>
                </div>
              ))}

              {/* Synonyms — shown in the book's original language */}
              {synonyms.length > 0 && (
                <div style={{ marginTop:6 }}>
                  <span style={{ fontSize:'0.63rem', fontWeight:700, color:'var(--text-muted)',
                    textTransform:'uppercase', letterSpacing:'0.6px' }}>
                    Synonyms ({langLabel})
                  </span>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:3 }}>
                    {synonyms.map((s, i) => (
                      <span key={i} style={{
                        fontSize:'0.7rem', padding:'1px 7px',
                        background:'rgba(99,102,241,0.12)',
                        border:'1px solid rgba(99,102,241,0.3)',
                        borderRadius:10, color:'#a5b4fc', cursor:'default'
                      }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Language selector — changes the meaning language */}
              <div style={{
                display:'flex', alignItems:'center', gap:6, marginTop:8,
                paddingTop:7, borderTop:'1px solid var(--border-color)'
              }}>
                <Globe size={12} color="var(--text-muted)" />
                <span style={{ fontSize:'0.68rem', color:'var(--text-muted)' }}>Meaning in:</span>
                <select value={targetLang} onChange={e => handleLangChange(e.target.value)}
                  style={{
                    background:'var(--bg-card)', border:'1px solid var(--border-color)',
                    color:'var(--text-primary)', borderRadius:6,
                    padding:'1px 5px', fontSize:'0.72rem', cursor:'pointer', outline:'none'
                  }}>
                  <option value="en">English</option>
                  <option value="ur">اردو</option>
                  <option value="hi">हिंदी</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="ar">العربية</option>
                  <option value="tr">Türkçe</option>
                  <option value="de">Deutsch</option>
                  <option value="zh">中文</option>
                </select>
              </div>
            </>
          )}
        </div>

        {/* ── Save button ── */}
        <div style={{ padding:'7px 12px 10px', borderTop:'1px solid var(--border-color)' }}>
          <button onClick={() => onSaveVocabulary(dictData || { word })} style={{
            width:'100%', padding:'6px',
            borderRadius:'8px',
            background: isSaved ? 'var(--bg-card)' : 'var(--accent-gradient)',
            border: isSaved ? '1px solid var(--border-color)' : 'none',
            color: isSaved ? 'var(--accent-primary)' : '#fff',
            fontSize:'0.78rem', fontWeight:700, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:5
          }}>
            {isSaved
              ? <><BookmarkCheck size={13}/> Saved</>
              : <><Bookmark size={13}/> Save to Vocabulary</>}
          </button>
        </div>
      </div>
    </>
  )
}
