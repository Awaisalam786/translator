import React, { useState } from 'react'
import { X, Bookmark, Trash2, Volume2, RotateCw, ChevronLeft, ChevronRight, Search, Layers, HelpCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { speakWord } from '../services/translationService'

export default function VocabularyModal({
  savedWords = [],
  onClose,
  onRemoveWord
}) {
  const [activeTab, setActiveTab] = useState('list') // 'list', 'flashcards', 'quiz'
  const [direction, setDirection] = useState('orig_to_target') // 'orig_to_target' or 'target_to_orig'
  const [searchTerm, setSearchTerm] = useState('')

  // Flashcards state
  const [cardIndex, setCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)

  // Quiz Mode state
  const [quizIndex, setQuizIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [isAnswered, setIsAnswered] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [score, setScore] = useState(0)

  const filteredWords = savedWords.filter(item =>
    item.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.translation && item.translation.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const currentCard = filteredWords[cardIndex] || savedWords[cardIndex]
  const currentQuizItem = savedWords[quizIndex]

  // Flashcard controls
  const handleNextCard = () => {
    setIsFlipped(false)
    setCardIndex(prev => (prev + 1) % savedWords.length)
  }

  const handlePrevCard = () => {
    setIsFlipped(false)
    setCardIndex(prev => (prev - 1 + savedWords.length) % savedWords.length)
  }

  // Helper to sanitize translation from loading placeholders ('…')
  const getDisplayTranslation = (item) => {
    if (!item) return ''
    if (!item.translation || item.translation === '…' || item.translation === '...') {
      return item.word
    }
    return item.translation
  }

  // Quiz submission & scoring
  const handleCheckAnswer = (e) => {
    e.preventDefault()
    if (!currentQuizItem || !userAnswer.trim()) return

    const expected = direction === 'orig_to_target'
      ? getDisplayTranslation(currentQuizItem)
      : currentQuizItem.word

    const inputClean = userAnswer.trim().toLowerCase()
    const expectedClean = expected.trim().toLowerCase()

    // Fuzzy check (exact match or substring)
    const match = inputClean === expectedClean || expectedClean.includes(inputClean) || inputClean.includes(expectedClean)

    setIsCorrect(match)
    if (match) {
      setScore(prev => prev + 1)
    }
    setIsAnswered(true)
  }

  const handleNextQuiz = () => {
    setUserAnswer('')
    setIsAnswered(false)
    setIsCorrect(false)
    setQuizIndex(prev => (prev + 1) % savedWords.length)
  }

  const handleResetQuiz = () => {
    setQuizIndex(0)
    setScore(0)
    setUserAnswer('')
    setIsAnswered(false)
    setIsCorrect(false)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '580px',
          backgroundColor: '#1a1d2e',
          color: '#f8fafc',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          padding: '24px',
          boxSizing: 'border-box',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <Bookmark size={20} />
            </div>
            <div>
              <h2 style={{
                fontFamily: '"Merriweather", "Georgia", serif',
                fontSize: '1.2rem',
                fontWeight: 700,
                color: '#f8fafc',
                margin: 0
              }}>
                Vocabulary Deck & Quiz
              </h2>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
                {savedWords.length} saved {savedWords.length === 1 ? 'word' : 'words'} in your deck
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Direction Switcher (German -> English vs English -> German) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#12151e',
          padding: '8px 12px',
          borderRadius: '10px',
          marginBottom: '14px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>
            Practice Direction:
          </span>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setDirection('orig_to_target')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: direction === 'orig_to_target' ? '#d97706' : 'rgba(255,255,255,0.06)',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Original → Translation
            </button>

            <button
              onClick={() => setDirection('target_to_orig')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: direction === 'target_to_orig' ? '#d97706' : 'rgba(255,255,255,0.06)',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Translation → Original
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
          <button
            onClick={() => setActiveTab('list')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'list' ? '#d97706' : 'rgba(255, 255, 255, 0.06)',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Word Bank ({savedWords.length})
          </button>

          <button
            onClick={() => setActiveTab('flashcards')}
            disabled={savedWords.length === 0}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'flashcards' ? '#d97706' : 'rgba(255, 255, 255, 0.06)',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: savedWords.length === 0 ? 'not-allowed' : 'pointer',
              opacity: savedWords.length === 0 ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Layers size={14} />
            <span>Flashcards</span>
          </button>

          <button
            onClick={() => setActiveTab('quiz')}
            disabled={savedWords.length === 0}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'quiz' ? '#d97706' : 'rgba(255, 255, 255, 0.06)',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: savedWords.length === 0 ? 'not-allowed' : 'pointer',
              opacity: savedWords.length === 0 ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <HelpCircle size={14} />
            <span>Typing Quiz</span>
          </button>
        </div>

        {/* Content Body */}
        {savedWords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>Your favorite deck is empty!</p>
            <p style={{ fontSize: '0.85rem', margin: 0 }}>
              Tap the bookmark icon on any word popup while reading to add it to your practice deck.
            </p>
          </div>
        ) : activeTab === 'list' ? (
          /* TAB 1: Word Bank List */
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {/* Search Filter */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Search saved words..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '8px',
                  backgroundColor: '#12151e',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Word Items */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredWords.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#12151e',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: '"Merriweather", "Georgia", serif', fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                        {item.word}
                      </span>
                      <button
                        onClick={() => speakWord(item.word, item.sourceLang || 'de')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#f59e0b',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        <Volume2 size={15} />
                      </button>
                    </div>

                    <div style={{ fontSize: '0.88rem', color: '#38bdf8', marginTop: '2px', fontWeight: 600 }}>
                      {item.translation}
                    </div>

                    {item.synonyms && item.synonyms.length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                        Similar: {item.synonyms.join(', ')}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => onRemoveWord(item.word)}
                    title="Remove from deck"
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#ef4444',
                      padding: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'flashcards' ? (
          /* TAB 2: Flashcards View */
          currentCard && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', flex: 1 }}>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Card {cardIndex + 1} of {savedWords.length}
              </div>

              {/* 3D Flip Card */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                style={{
                  width: '100%',
                  maxWidth: '380px',
                  height: '200px',
                  backgroundColor: isFlipped ? '#1e2230' : '#12151e',
                  border: isFlipped ? '1px solid #d97706' : '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  textAlign: 'center',
                  position: 'relative',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                  transition: 'all 0.2s ease'
                }}
              >
                {!isFlipped ? (
                  /* Front of card */
                  <>
                    <span style={{ fontFamily: '"Merriweather", "Georgia", serif', fontSize: '1.8rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
                      {direction === 'orig_to_target' ? currentCard.word : getDisplayTranslation(currentCard)}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#d97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <RotateCw size={12} /> Tap card to reveal answer
                    </span>
                  </>
                ) : (
                  /* Back of card */
                  <>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#38bdf8', marginBottom: '8px' }}>
                      {direction === 'orig_to_target' ? getDisplayTranslation(currentCard) : currentCard.word}
                    </span>
                    {currentCard.synonyms && currentCard.synonyms.length > 0 && (
                      <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                        Similar: {currentCard.synonyms.join(', ')}
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button
                  onClick={handlePrevCard}
                  style={{
                    padding: '8px 16px', borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    color: '#f8fafc', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <ChevronLeft size={16} /> Prev
                </button>

                <button
                  onClick={() => speakWord(currentCard.word, currentCard.sourceLang || 'de')}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: 'none',
                    backgroundColor: 'rgba(217, 119, 6, 0.2)', color: '#f59e0b',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Volume2 size={16} /> Pronounce
                </button>

                <button
                  onClick={handleNextCard}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: 'none',
                    backgroundColor: '#d97706', color: '#ffffff', fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )
        ) : (
          /* TAB 3: Interactive Typing Quiz */
          currentQuizItem && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
              {/* Header stats */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', color: '#94a3b8' }}>
                <span>Question {quizIndex + 1} of {savedWords.length}</span>
                <span style={{ fontWeight: 700, color: '#f59e0b' }}>Score: {score}</span>
              </div>

              {/* Question Card */}
              <div style={{
                backgroundColor: '#12151e',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '8px' }}>
                  {direction === 'orig_to_target' ? 'What is the translation for:' : 'What is the original word for:'}
                </div>

                <div style={{ fontFamily: '"Merriweather", "Georgia", serif', fontSize: '1.8rem', fontWeight: 700, color: '#f8fafc', marginBottom: '16px' }}>
                  {direction === 'orig_to_target' ? currentQuizItem.word : getDisplayTranslation(currentQuizItem)}
                </div>

                {/* Answer Form */}
                <form onSubmit={handleCheckAnswer} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input
                    type="text"
                    placeholder="Type your answer here..."
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    disabled={isAnswered}
                    autoFocus
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#1a1d2e',
                      border: isAnswered ? (isCorrect ? '1px solid #10b981' : '1px solid #ef4444') : '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#f8fafc',
                      fontSize: '1rem',
                      outline: 'none',
                      textAlign: 'center'
                    }}
                  />

                  {!isAnswered ? (
                    <button
                      type="submit"
                      disabled={!userAnswer.trim()}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#d97706',
                        color: '#ffffff',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        cursor: userAnswer.trim() ? 'pointer' : 'not-allowed',
                        opacity: userAnswer.trim() ? 1 : 0.4
                      }}
                    >
                      Check Answer
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                      {/* Feedback Result */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        fontSize: '1rem', fontWeight: 700,
                        color: isCorrect ? '#10b981' : '#ef4444'
                      }}>
                        {isCorrect ? <CheckCircle size={20} /> : <XCircle size={20} />}
                        <span>{isCorrect ? 'Correct!' : 'Incorrect!'}</span>
                      </div>

                      {!isCorrect && (
                        <div style={{ fontSize: '0.88rem', color: '#94a3b8' }}>
                          Correct Answer: <strong style={{ color: '#38bdf8' }}>
                            {direction === 'orig_to_target' ? currentQuizItem.translation : currentQuizItem.word}
                          </strong>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleNextQuiz}
                        style={{
                          padding: '10px 24px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: '#d97706',
                          color: '#ffffff',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>Next Question</span>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </form>
              </div>

              {/* Reset Quiz Button */}
              <button
                onClick={handleResetQuiz}
                style={{
                  alignSelf: 'center', background: 'none', border: 'none',
                  color: '#64748b', fontSize: '0.8rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <RefreshCw size={13} /> Reset Quiz
              </button>
            </div>
          )
        )}
      </div>
    </div>
  )
}
