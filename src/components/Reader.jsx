import React, { useState, useEffect, useRef, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Volume2, VolumeX, Eye, BookOpen } from 'lucide-react'
import VisualPdfReader from './VisualPdfReader'

export default function Reader({ 
  book, 
  chapterIndex, 
  setChapterIndex, 
  onSelectWord,
  selectedWord 
}) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [readingProgress, setReadingProgress] = useState(0)
  const [viewMode, setViewMode] = useState('text') // 'text' or 'pdf'
  const scrollRef = useRef(null)

  const currentChapter = book?.chapters?.[chapterIndex] || book?.chapters?.[0]

  // Default to PDF mode if PDF file buffer is present
  useEffect(() => {
    if (book?.isPdf && book?.fileBuffer) {
      setViewMode('pdf')
    } else {
      setViewMode('text')
    }
  }, [book])

  // Track reading progress on scroll
  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const totalScrollable = scrollHeight - clientHeight
    if (totalScrollable > 0) {
      const pct = Math.round((scrollTop / totalScrollable) * 100)
      setReadingProgress(pct)
    }
  }

  // Text to Speech
  const toggleSpeech = () => {
    if (!('speechSynthesis' in window)) return
    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    } else {
      if (!currentChapter) return
      const textToRead = currentChapter.paragraphs.join(' ')
      const utterance = new SpeechSynthesisUtterance(textToRead)
      utterance.rate = 0.95
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)
      window.speechSynthesis.speak(utterance)
      setIsSpeaking(true)
    }
  }

  // Stop speech when chapter changes
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [chapterIndex, book])

  /**
   * Click handler for paragraph container using caret / text selection detection as backup.
   */
  const handleParagraphClick = (e) => {
    const selection = window.getSelection()
    const selectedText = selection?.toString().trim()
    
    if (selectedText && selectedText.length > 0 && selectedText.length < 40) {
      onSelectWord(selectedText)
      return
    }

    let word = ''
    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(e.clientX, e.clientY)
      if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
        const text = range.startContainer.textContent
        const offset = range.startOffset
        
        let start = offset
        while (start > 0 && /[\wäöüßÄÖÜ]/.test(text[start - 1])) start--
        let end = offset
        while (end < text.length && /[\wäöüßÄÖÜ]/.test(text[end])) end++
        
        word = text.substring(start, end).trim()
      }
    }

    if (word && word.length > 0) {
      onSelectWord(word)
    }
  }

  if (!book || !currentChapter) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        No book loaded. Please select a book from Library.
      </div>
    )
  }

  if (viewMode === 'pdf' && book?.fileBuffer) {
    return (
      <VisualPdfReader 
        fileBuffer={book.fileBuffer}
        onSelectWord={onSelectWord}
        selectedWord={selectedWord}
      />
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Reading Progress Indicator Bar */}
      <div style={{ height: '3px', background: 'var(--border-color)', width: '100%' }}>
        <div 
          style={{ 
            height: '100%', 
            width: `${readingProgress}%`, 
            background: 'var(--accent-gradient)',
            transition: 'width 0.2s ease'
          }} 
        />
      </div>

      {/* Reader Scrollable Canvas */}
      <div className="reader-scroll-area" ref={scrollRef} onScroll={handleScroll}>
        <article className="book-paper">
          {/* Book Header info */}
          <div className="book-header">
            <h1 className="book-title">{book.title}</h1>
            <div className="book-meta">
              <span>By {book.author || 'Unknown Author'}</span>
              <span>•</span>
              <span>Chapter {chapterIndex + 1} of {book.chapters.length}</span>
              <span>•</span>
              <button 
                onClick={toggleSpeech} 
                className="audio-btn" 
                title={isSpeaking ? "Pause Audio Reading" : "Read Chapter Aloud"}
                style={{ width: '28px', height: '28px' }}
              >
                {isSpeaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
            </div>
          </div>

          {/* Chapter Title */}
          <h2 className="chapter-title">{currentChapter.title}</h2>

          {/* Chapter Content Paragraphs with Caret & Word Click Support */}
          {currentChapter.paragraphs.map((p, idx) => (
            <ParagraphBlock 
              key={idx}
              text={p}
              selectedWord={selectedWord}
              onSelectWord={onSelectWord}
              onContainerClick={handleParagraphClick}
            />
          ))}

          {/* Bottom Pagination Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '60px', paddingTop: '20px', borderTop: '1px dashed var(--border-color)' }}>
            <button
              className="nav-btn"
              disabled={chapterIndex === 0}
              onClick={() => setChapterIndex(prev => Math.max(0, prev - 1))}
              style={{ opacity: chapterIndex === 0 ? 0.4 : 1 }}
            >
              <ChevronLeft size={18} />
              <span>Previous Chapter</span>
            </button>

            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {readingProgress}% Read
            </span>

            <button
              className="nav-btn"
              disabled={chapterIndex >= book.chapters.length - 1}
              onClick={() => setChapterIndex(prev => Math.min(book.chapters.length - 1, prev + 1))}
              style={{ opacity: chapterIndex >= book.chapters.length - 1 ? 0.4 : 1 }}
            >
              <span>Next Chapter</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </article>
      </div>
    </div>
  )
}

/**
 * Memoized Paragraph Block supporting German and international word characters
 */
const ParagraphBlock = React.memo(({ text, selectedWord, onSelectWord, onContainerClick }) => {
  const elements = useMemo(() => {
    const parts = text.split(/([a-zA-Z0-9'-äöüßÄÖÜ]+)/g)
    return parts.map((part, idx) => {
      const isWord = /^[a-zA-Z0-9'-äöüßÄÖÜ]+$/.test(part)
      if (isWord) {
        const isSelected = selectedWord && selectedWord.toLowerCase() === part.toLowerCase()
        return (
          <span
            key={idx}
            className={`word-span ${isSelected ? 'selected' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onSelectWord(part)
            }}
          >
            {part}
          </span>
        )
      } else {
        return part
      }
    })
  }, [text, selectedWord, onSelectWord])

  return (
    <p className="book-paragraph" onClick={onContainerClick}>
      {elements}
    </p>
  )
})


