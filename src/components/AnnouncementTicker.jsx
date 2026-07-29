import React, { useState, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'
import {
  fetchActiveAnnouncement,
  subscribeToAnnouncementRealtime,
  parseSpeedToDuration
} from '../services/announcementService'

export default function AnnouncementTicker({ isReaderView = false, isPremium = false }) {
  const [announcement, setAnnouncement] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    loadAnnouncement()

    // Realtime listener for zero-refresh instant updates
    const unsubscribe = subscribeToAnnouncementRealtime((updatedData) => {
      if (updatedData) {
        setAnnouncement(updatedData)
        setVisible(updatedData.enabled)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const loadAnnouncement = async () => {
    const data = await fetchActiveAnnouncement()
    if (data) {
      setAnnouncement(data)
      setVisible(data.enabled)
    }
  }

  // ── Visibility Rules ────────────────────────────────────────────────────────
  // 1. Inactive -> Hide
  // 2. Premium Users -> Show ONLY on Home Screen (hide inside Reader View)
  // 3. Trial Users -> Show EVERYWHERE across all views
  if (!visible || !announcement || !announcement.enabled) {
    return null
  }

  if (isPremium && isReaderView) {
    return null
  }

  const duration = announcement.speedDuration || parseSpeedToDuration(announcement.speed)

  // Text content with optional icon badge
  const contentSpan = (
    <span
      className="ticker-item"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        whiteSpace: 'nowrap'
      }}
    >
      {announcement.showIcon && announcement.icon && (
        <span style={{ fontSize: '1.1em', flexShrink: 0 }}>{announcement.icon}</span>
      )}
      <span>{announcement.text}</span>
      {announcement.linkUrl && (
        <ExternalLink size={13} style={{ flexShrink: 0, opacity: 0.85 }} />
      )}
    </span>
  )

  const wrappedContent = announcement.linkUrl ? (
    <a
      href={announcement.linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'inherit', textDecoration: 'none' }}
    >
      {contentSpan}
    </a>
  ) : (
    contentSpan
  )

  return (
    <div
      aria-label="Announcement Ticker"
      className={`announcement-ticker-container ${announcement.pauseOnHover ? 'pause-on-hover' : ''}`}
      style={{
        position: 'relative',
        top: 0,
        left: 0,
        right: 0,
        width: '100%',
        zIndex: 9999,
        backgroundColor: announcement.backgroundColor || '#d97706',
        color: announcement.textColor || '#ffffff',
        fontSize: announcement.fontSize || '14px',
        fontWeight: announcement.fontWeight || '600',
        height: '38px',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
        userSelect: 'none'
      }}
    >
      {/* Dynamic Key forces instant animation duration re-bind when speed changes */}
      <div
        key={`${duration}_${announcement.speed}_${announcement.updatedAt || ''}`}
        className="ticker-track"
        style={{
          display: 'inline-block',
          whiteSpace: 'nowrap',
          willChange: 'transform',
          animation: `tickerMarqueeSmooth ${duration} linear ${announcement.loop ? 'infinite' : '1'}`
        }}
      >
        {wrappedContent}
      </div>

      {/* Embedded CSS Animations */}
      <style>{`
        @keyframes tickerMarqueeSmooth {
          0% {
            transform: translate3d(100vw, 0, 0);
          }
          100% {
            transform: translate3d(-100%, 0, 0);
          }
        }

        .announcement-ticker-container.pause-on-hover:hover .ticker-track {
          animation-play-state: paused !important;
        }

        /* Accessibility: Reduced Motion Support */
        @media (prefers-reduced-motion: reduce) {
          .ticker-track {
            animation: none !important;
            transform: none !important;
            text-align: center;
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
