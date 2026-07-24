import React from 'react'
import { BookOpen, Bookmark, Settings, Upload, Sparkles, Layers, Volume2 } from 'lucide-react'

export default function Navbar({ 
  book, 
  onOpenLibrary, 
  onOpenVocabulary, 
  onOpenSettings,
  savedWordsCount,
  activeTheme,
  setTheme
}) {
  const themes = [
    { id: 'dark', label: 'Dark Velvet', bg: '#0f111a' },
    { id: 'sepia', label: 'Warm Sepia', bg: '#f8f1e5' },
    { id: 'obsidian', label: 'Obsidian Night', bg: '#050508' },
    { id: 'paper', label: 'Paper Light', bg: '#ffffff' }
  ]

  return (
    <header className="navbar">
      <div className="brand" onClick={onOpenLibrary} title="Open Library">
        <div className="brand-icon">
          <BookOpen size={20} />
        </div>
        <span>LexiRead</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button className="nav-btn" onClick={onOpenLibrary}>
          <Upload size={16} />
          <span>Library</span>
        </button>

        <button className="nav-btn" onClick={onOpenVocabulary}>
          <Bookmark size={16} />
          <span>Vocabulary</span>
          {savedWordsCount > 0 && <span className="badge">{savedWordsCount}</span>}
        </button>

        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-card)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          {themes.map(t => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              title={t.label}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: t.bg,
                border: activeTheme === t.id ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                cursor: 'pointer',
                transition: 'transform 0.15s ease',
                transform: activeTheme === t.id ? 'scale(1.15)' : 'scale(1)'
              }}
            />
          ))}
        </div>

        <button className="nav-btn" onClick={onOpenSettings} title="Reader Settings">
          <Settings size={16} />
        </button>
      </div>
    </header>
  )
}
