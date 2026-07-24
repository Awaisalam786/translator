import React, { useState, useEffect } from 'react'
import StudentAuthGate from './components/StudentAuthGate'
import LibraryShelf from './components/LibraryShelf'
import ReaderView from './components/ReaderView'
import VocabularyModal from './components/VocabularyModal'
import ThemeSettingsModal from './components/ThemeSettingsModal'
import { initStorage } from './services/storageService'

const DECK_STORAGE_KEY = 'leselampe_deck'
const THEME_STORAGE_KEY = 'leselampe_theme'

export default function App() {
  const [activeBook, setActiveBook] = useState(null)
  const [showDeckModal, setShowDeckModal] = useState(false)
  const [showThemeModal, setShowThemeModal] = useState(false)

  // Reading Theme state ('dark' | 'sepia' | 'light' | 'forest')
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'dark'
  })

  // Apply theme data attribute to document html root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme)
    localStorage.setItem(THEME_STORAGE_KEY, currentTheme)
  }, [currentTheme])

  // Saved Favorite Vocabulary Deck state
  const [savedWords, setSavedWords] = useState(() => {
    try {
      const stored = localStorage.getItem(DECK_STORAGE_KEY)
      const list = stored ? JSON.parse(stored) : []
      return list.map(item => ({
        ...item,
        translation: (!item.translation || item.translation === '…' || item.translation === '...') ? item.word : item.translation
      }))
    } catch {
      return []
    }
  })

  // Initialize storage persistence on mount
  useEffect(() => {
    initStorage()
  }, [])

  // Sync savedWords to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(savedWords))
    } catch (e) {
      console.error('[Deck] Error saving deck:', e)
    }
  }, [savedWords])

  // Toggle favorite word in deck
  const handleToggleFavorite = (item) => {
    setSavedWords((prev) => {
      const cleanTrans = (!item.translation || item.translation === '…' || item.translation === '...') ? item.word : item.translation
      const existsIndex = prev.findIndex(w => w.word.toLowerCase() === item.word.toLowerCase())

      if (existsIndex >= 0) {
        const existingTrans = prev[existsIndex].translation
        if ((!existingTrans || existingTrans === '…' || existingTrans === '...') && cleanTrans !== item.word) {
          const copy = [...prev]
          copy[existsIndex] = { ...copy[existsIndex], translation: cleanTrans, synonyms: item.synonyms || copy[existsIndex].synonyms }
          return copy
        }
        return prev.filter(w => w.word.toLowerCase() !== item.word.toLowerCase())
      } else {
        return [{
          word: item.word,
          translation: cleanTrans,
          synonyms: item.synonyms || [],
          sourceLang: item.sourceLang || 'de',
          targetLang: item.targetLang || 'en',
          dateAdded: new Date().toISOString()
        }, ...prev]
      }
    })
  }

  const handleRemoveWord = (wordToRemove) => {
    setSavedWords((prev) => prev.filter(w => w.word.toLowerCase() !== wordToRemove.toLowerCase()))
  }

  const isWordFavorite = (word) => {
    if (!word) return false
    return savedWords.some(w => w.word.toLowerCase() === word.toLowerCase())
  }

  return (
    <StudentAuthGate>
      {activeBook === null ? (
        <LibraryShelf
          onSelectBook={(book) => setActiveBook(book)}
          onOpenDeck={() => setShowDeckModal(true)}
          onOpenTheme={() => setShowThemeModal(true)}
          savedWordsCount={savedWords.length}
        />
      ) : (
        <ReaderView
          book={activeBook}
          onBackToLibrary={() => setActiveBook(null)}
          onOpenDeck={() => setShowDeckModal(true)}
          onOpenTheme={() => setShowThemeModal(true)}
          savedWordsCount={savedWords.length}
          onToggleFavorite={handleToggleFavorite}
          isWordFavorite={isWordFavorite}
        />
      )}

      {/* Favorite Vocabulary Deck Modal */}
      {showDeckModal && (
        <VocabularyModal
          savedWords={savedWords}
          onClose={() => setShowDeckModal(false)}
          onRemoveWord={handleRemoveWord}
        />
      )}

      {/* Reading Theme Options Settings Modal */}
      {showThemeModal && (
        <ThemeSettingsModal
          currentTheme={currentTheme}
          onSelectTheme={(themeId) => setCurrentTheme(themeId)}
          onClose={() => setShowThemeModal(false)}
        />
      )}
    </StudentAuthGate>
  )
}
