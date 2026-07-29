import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ppyaxlytlrjtqdpbtjnk.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_xfT7EODlWKoMGeJTt7GMHA_qNvN3el-'
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const ANNOUNCEMENT_STORAGE_KEY = 'leselampe_announcement_dismissed'
export const LIVE_CONFIG_STORAGE_KEY = 'leselampe_announcement_live_config'

export const SPEED_MAP = {
  very_slow: '50s',
  slow: '35s',
  normal: '20s',
  fast: '10s',
  very_fast: '4s'
}

export function parseSpeedToDuration(speedInput) {
  if (!speedInput) return '20s'
  if (SPEED_MAP[speedInput]) return SPEED_MAP[speedInput]
  if (typeof speedInput === 'string') {
    if (speedInput.endsWith('s')) return speedInput
    if (!isNaN(parseFloat(speedInput))) return `${parseFloat(speedInput)}s`
  }
  return '20s'
}

/**
 * Fetch active announcement ticker settings from LocalStorage or Supabase
 */
export async function fetchActiveAnnouncement() {
  // Check local live override first for instant sync
  try {
    const localStr = localStorage.getItem(LIVE_CONFIG_STORAGE_KEY)
    if (localStr) {
      const parsed = JSON.parse(localStr)
      if (parsed) return formatAnnouncementData(parsed)
    }
  } catch (e) {}

  try {
    const { data, error } = await supabase
      .from('site_announcements')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (data && !error) {
      return formatAnnouncementData(data)
    }
  } catch (e) {
    console.warn('[AnnouncementService] Supabase fetch error:', e)
  }

  // Active default fallback
  return getDefaultAnnouncementData()
}

/**
 * Format database record into clean announcement ticker object
 */
export function formatAnnouncementData(data) {
  const speedKey = data.speed || 'normal'
  const duration = parseSpeedToDuration(speedKey)

  return {
    id: data.id || 'default_announcement',
    text: data.announcement_text || data.message || '🎉 Welcome to LeseLampe! Read German books & tap any word for instant translations.',
    enabled: data.enabled !== undefined ? Boolean(data.enabled) : Boolean(data.is_active),
    speed: speedKey,
    speedDuration: duration,
    backgroundColor: data.background_color || '#d97706',
    textColor: data.text_color || '#ffffff',
    fontSize: data.font_size || '14px',
    fontWeight: data.font_weight || '600',
    pauseOnHover: data.pause_on_hover !== undefined ? Boolean(data.pause_on_hover) : true,
    loop: data.loop !== undefined ? Boolean(data.loop) : true,
    showIcon: data.show_icon !== undefined ? Boolean(data.show_icon) : true,
    icon: data.icon || '📢',
    linkUrl: data.link_url || '',
    updatedAt: data.updated_at || new Date().toISOString()
  }
}

export function getDefaultAnnouncementData() {
  return {
    id: 'default_announcement',
    text: '🎉 Welcome to LeseLampe! Read German books & tap any word for instant translations.',
    enabled: true,
    speed: 'normal',
    speedDuration: '20s',
    backgroundColor: '#d97706',
    textColor: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    pauseOnHover: true,
    loop: true,
    showIcon: true,
    icon: '📢',
    linkUrl: '',
    updatedAt: 'initial'
  }
}

/**
 * Subscribe to Supabase Realtime updates AND local storage events
 */
export function subscribeToAnnouncementRealtime(onUpdate) {
  // 1. Storage Event Listener for instant same-browser cross-tab updates
  const handleStorageEvent = (e) => {
    if (e.key === LIVE_CONFIG_STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue)
        onUpdate(formatAnnouncementData(parsed))
      } catch (err) {}
    }
  }
  window.addEventListener('storage', handleStorageEvent)

  // 2. Supabase Realtime Channel
  try {
    const channel = supabase
      .channel('public:site_announcements')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_announcements' },
        (payload) => {
          if (payload.new) {
            const formatted = formatAnnouncementData(payload.new)
            onUpdate(formatted)
          }
        }
      )
      .subscribe()

    return () => {
      window.removeEventListener('storage', handleStorageEvent)
      supabase.removeChannel(channel)
    }
  } catch (e) {
    console.warn('[AnnouncementService] Realtime subscription error:', e)
    return () => {
      window.removeEventListener('storage', handleStorageEvent)
    }
  }
}

/**
 * Dismissal storage helpers
 */
export function isAnnouncementDismissed(announcementId, updatedAt) {
  try {
    const dismissedKey = localStorage.getItem(`${ANNOUNCEMENT_STORAGE_KEY}_${announcementId}`)
    return dismissedKey === updatedAt
  } catch (e) {
    return false
  }
}

export function dismissAnnouncement(announcementId, updatedAt) {
  try {
    localStorage.setItem(`${ANNOUNCEMENT_STORAGE_KEY}_${announcementId}`, updatedAt)
  } catch (e) {}
}
