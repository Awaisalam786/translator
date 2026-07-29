import React, { useState, useEffect } from 'react'
import { X, ExternalLink, Megaphone } from 'lucide-react'
import { fetchActiveAnnouncement, isAnnouncementDismissed, dismissAnnouncement } from '../services/announcementService'

export default function AnnouncementBar({ isReaderView = false, isPremium = false }) {
  const [announcement, setAnnouncement] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    loadAnnouncement()
  }, [])

  const loadAnnouncement = async () => {
    const data = await fetchActiveAnnouncement()
    if (data && data.isActive && data.message) {
      const dismissed = isAnnouncementDismissed(data.id, data.updatedAt)
      if (!dismissed) {
        setAnnouncement(data)
        setVisible(true)
      }
    }
  }

  const handleDismiss = () => {
    if (announcement) {
      dismissAnnouncement(announcement.id, announcement.updatedAt)
    }
    setVisible(false)
  }

  // ── Visibility Rules: ──
  // 1. If not active or dismissed -> Hide
  // 2. For Premium Users: Show ONLY on Home Screen (hide inside Reader View)
  // 3. For Trial Users: Show EVERYWHERE on all tabs & views
  if (!visible || !announcement || !announcement.isActive) {
    return null
  }

  if (isPremium && isReaderView) {
    return null
  }

  const content = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      <Megaphone size={14} style={{ flexShrink: 0 }} />
      <span>{announcement.message}</span>
      {announcement.linkUrl && (
        <ExternalLink size={12} style={{ flexShrink: 0, opacity: 0.85 }} />
      )}
    </span>
  )

  return (
    <div
      aria-label="Announcement Bar"
      style={{
        position: 'relative',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: announcement.backgroundColor || '#d97706',
        color: announcement.textColor || '#ffffff',
        padding: '8px 40px 8px 16px',
        fontSize: '0.84rem',
        fontWeight: 600,
        textAlign: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        transition: 'all 0.3s ease'
      }}
    >
      {/* Dynamic Content: Scrolling (Marquee) vs Static */}
      {announcement.isScrolling ? (
        <div style={{
          width: '100%',
          overflow: 'hidden',
          whiteSpace: 'nowrap'
        }}>
          <div className="announcement-marquee" style={{
            display: 'inline-block',
            animation: 'marquee 18s linear infinite'
          }}>
            {announcement.linkUrl ? (
              <a
                href={announcement.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px' }}
              >
                {content}
              </a>
            ) : content}
          </div>
        </div>
      ) : (
        <div style={{
          maxWidth: '1000px',
          margin: '0 auto',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {announcement.linkUrl ? (
            <a
              href={announcement.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px' }}
            >
              {content}
            </a>
          ) : content}
        </div>
      )}

      {/* Close (X) Button */}
      <button
        onClick={handleDismiss}
        title="Dismiss announcement"
        aria-label="Dismiss announcement"
        style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'rgba(0, 0, 0, 0.18)',
          border: 'none',
          borderRadius: '50%',
          color: announcement.textColor || '#ffffff',
          width: '22px',
          height: '22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          opacity: 0.85,
          transition: 'opacity 0.2s ease'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.85')}
      >
        <X size={14} />
      </button>

      {/* Marquee Animation Keyframes injected in component */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  )
}
