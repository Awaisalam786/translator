import React, { useState, useEffect } from 'react'
import PasswordLock from './components/PasswordLock'
import LibraryShelf from './components/LibraryShelf'
import ReaderView from './components/ReaderView'
import VocabularyModal from './components/VocabularyModal'
import AdminPanelModal from './components/AdminPanelModal'
import ThemeSettingsModal from './components/ThemeSettingsModal'
import { initStorage } from './services/storageService'

const DECK_STORAGE_KEY = 'leselampe_deck'
const THEME_STORAGE_KEY = 'leselampe_theme'

export default function App() {
  const [activeBook, setActiveBook] = useState(null)
  const [showDeckModal, setShowDeckModal] = useState(false)
  const [showAdminModal, setShowAdminModal] = useState(false)
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

  // Initialize storage persistence & Secret Admin Listeners on mount
  useEffect(() => {
    initStorage()

    // 1. Check URL parameters for secret admin trigger: ?admin=true or #admin
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('admin') === 'true' || window.location.hash === '#admin') {
      setShowAdminModal(true)
    }

    // 2. Global Secret Keyboard Shortcut: Ctrl + Shift + A (or Cmd + Shift + A)
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault()
        setShowAdminModal(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
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
    <PasswordLock>
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

      {/* Admin Panel Modal (Opened secretly via ?admin=true or Ctrl+Shift+A) */}
      {showAdminModal && (
        <AdminPanelModal
          savedWords={savedWords}
          onClose={() => setShowAdminModal(false)}
          onRefreshData={() => {}}
          onClearDeck={() => setSavedWords([])}
        />
      )}
    </PasswordLock>
  )
}
