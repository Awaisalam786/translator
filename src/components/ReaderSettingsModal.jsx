import React from 'react'
import { X, Type, Sliders, Palette, Layout } from 'lucide-react'

export default function ReaderSettingsModal({ 
  onClose,
  fontFamily,
  setFontFamily,
  fontSize,
  setFontSize,
  lineHeight,
  setLineHeight,
  maxWidth,
  setMaxWidth,
  activeTheme,
  setTheme
}) {
  const fonts = [
    { id: 'var(--font-serif)', name: 'Merriweather (Classic Serif)' },
    { id: 'var(--font-sans)', name: 'Inter (Modern Sans)' },
    { id: 'var(--font-display)', name: 'Playfair Display (Elegant)' },
    { id: 'var(--font-dyslexic)', name: 'Lexend (High Readability)' },
    { id: 'var(--font-mono)', name: 'JetBrains Mono (Monospace)' }
  ]

  const themes = [
    { id: 'dark', label: 'Dark Velvet', desc: 'Sleek dark theme for night reading' },
    { id: 'sepia', label: 'Warm Sepia', desc: 'Soft warm vintage tone' },
    { id: 'obsidian', label: 'Obsidian Night', desc: 'Deep high contrast black' },
    { id: 'paper', label: 'Paper Light', desc: 'Clean bright daylight canvas' }
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Type size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>Reader Customization</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Adjust typography, text scaling, margins, and themes</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Theme Selector */}
          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Palette size={16} color="var(--accent-primary)" />
              <span>Reader Theme</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {themes.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: `1px solid ${activeTheme === t.id ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Font Family */}
          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Type size={16} color="var(--accent-primary)" />
              <span>Typography Font</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {fonts.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFontFamily(f.id)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${fontFamily === f.id ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    background: fontFamily === f.id ? 'var(--accent-light)' : 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontFamily: f.id,
                    fontSize: '1rem',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Font Size</label>
              <span style={{ fontSize: '0.875rem', color: 'var(--accent-primary)', fontWeight: 600 }}>{fontSize}px</span>
            </div>
            <input 
              type="range"
              min="14"
              max="30"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
          </div>

          {/* Line Height Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Line Spacing</label>
              <span style={{ fontSize: '0.875rem', color: 'var(--accent-primary)', fontWeight: 600 }}>{lineHeight}</span>
            </div>
            <input 
              type="range"
              min="1.4"
              max="2.2"
              step="0.1"
              value={lineHeight}
              onChange={(e) => setLineHeight(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
