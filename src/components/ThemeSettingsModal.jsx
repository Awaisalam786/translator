import React from 'react'
import { X, Palette, Check, Moon, Sun, BookOpen, Trees } from 'lucide-react'

export const THEMES = [
  {
    id: 'dark',
    name: 'Midnight Dark',
    icon: Moon,
    bg: '#0f121d',
    card: '#1a1d2e',
    accent: '#d97706',
    text: '#f8fafc',
    description: 'Deep obsidian theme for night reading'
  },
  {
    id: 'sepia',
    name: 'Warm Sepia Paper',
    icon: BookOpen,
    bg: '#f5ebd6',
    card: '#eae0ca',
    accent: '#c25e00',
    text: '#2b261f',
    description: 'Cozy paper tone for reduced eye strain'
  },
  {
    id: 'light',
    name: 'Clean Day Light',
    icon: Sun,
    bg: '#f8fafc',
    card: '#ffffff',
    accent: '#2563eb',
    text: '#0f172a',
    description: 'Bright high-contrast daylight theme'
  },
  {
    id: 'forest',
    name: 'Emerald Forest',
    icon: Trees,
    bg: '#0b1712',
    card: '#13261e',
    accent: '#10b981',
    text: '#ecfdf5',
    description: 'Calming dark green pine theme'
  }
]

export default function ThemeSettingsModal({ currentTheme = 'dark', onSelectTheme, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 350,
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
          maxWidth: '460px',
          backgroundColor: '#1a1d2e',
          color: '#f8fafc',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          padding: '24px',
          boxSizing: 'border-box'
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
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
              <Palette size={20} />
            </div>
            <div>
              <h2 style={{ fontFamily: '"Merriweather", serif', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                Reading Theme Options
              </h2>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
                Customize app colors and book background
              </p>
            </div>
          </div>

          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Theme Options Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {THEMES.map((theme) => {
            const Icon = theme.icon
            const isSelected = currentTheme === theme.id

            return (
              <div
                key={theme.id}
                onClick={() => onSelectTheme(theme.id)}
                style={{
                  backgroundColor: '#12151e',
                  border: isSelected ? `2px solid ${theme.accent}` : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {/* Theme Color Preview Circle */}
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: theme.bg,
                    border: `2px solid ${theme.accent}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: theme.text,
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                  }}>
                    <Icon size={18} color={theme.accent} />
                  </div>

                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                      {theme.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                      {theme.description}
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: theme.accent,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Check size={14} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
