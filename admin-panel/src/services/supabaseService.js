import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL_KEY = 'leselampe_supabase_url'
const SUPABASE_KEY_KEY = 'leselampe_supabase_anon_key'

// Prioritize environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
const envUrl = import.meta.env.VITE_SUPABASE_URL
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let currentUrl = envUrl || localStorage.getItem(SUPABASE_URL_KEY) || 'https://ppyaxlytlrjtqdpbtjnk.supabase.co'
let currentKey = envKey || localStorage.getItem(SUPABASE_KEY_KEY) || 'sb_publishable_xfT7EODlWKoMGeJTt7GMHA_qNvN3el-'

let supabase = createClient(currentUrl, currentKey)

export function getSupabaseCredentials() {
  return {
    url: envUrl || localStorage.getItem(SUPABASE_URL_KEY) || '',
    key: envKey || localStorage.getItem(SUPABASE_KEY_KEY) || ''
  }
}

export function configureSupabase(url, key) {
  if (url && key) {
    localStorage.setItem(SUPABASE_URL_KEY, url.trim())
    localStorage.setItem(SUPABASE_KEY_KEY, key.trim())
    supabase = createClient(url.trim(), key.trim())
    return true
  }
  return false
}

// ── Supabase Auth Admin Authentication ─────────────────────────────────────────
export async function supabaseAdminLogin(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { success: false, error: error.message }
    return { success: true, user: data.user, session: data.session }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

export async function supabaseAdminLogout() {
  try {
    await supabase.auth.signOut()
  } catch (e) {}
}

export async function getSupabaseUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

// ── Delete User via Secure Supabase Edge Function ──────────────────────────────
export async function deleteUserAccount(userId) {
  try {
    const { data, error } = await supabase.functions.invoke('delete-user', {
      body: { userId }
    })

    if (error) return { success: false, error: error.message }
    if (data?.error) return { success: false, error: data.error }
    return { success: true }
  } catch (e) {
    // Direct profile deletion fallback
    try {
      const { error: profError } = await supabase.from('profiles').delete().eq('id', userId)
      if (!profError) return { success: true }
    } catch {}
    return { success: false, error: e.message }
  }
}

// ── Fetch Registered User Profiles Live from Supabase ────────────────────────
export async function fetchSupabaseProfiles() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (data && !error) {
      return data.map(p => ({
        id: p.id,
        email: p.email || 'No email registered',
        role: p.role || 'student',
        created_at: p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/A',
        trial_started_at: p.trial_started_at,
        status: 'Active'
      }))
    }
  } catch (e) {
    console.warn('[Supabase] fetchProfiles error:', e)
  }
  return []
}

// ── Fetch Settings from Supabase ──────────────────────────────────────────────
export async function fetchSupabaseSettings() {
  try {
    const { data, error } = await supabase.from('settings').select('*').limit(1).single()
    if (data && !error) {
      return {
        jazzCashNumber: data.jazz_cash_number || '0300-1234567',
        jazzCashTitle: data.jazz_cash_title || 'Awais Alam',
        easyPaisaNumber: data.easy_paisa_number || '0300-1234567',
        easyPaisaTitle: data.easy_paisa_title || 'Awais Alam',
        subscriptionFee: data.subscription_fee || 500
      }
    }
  } catch (e) {
    console.warn('[Supabase] fetchSettings error:', e)
  }
  return null
}

// ── Update Settings in Supabase ──────────────────────────────────────────────
export async function updateSupabaseSettings(settings) {
  try {
    const payload = {
      jazz_cash_number: settings.jazzCashNumber,
      jazz_cash_title: settings.jazzCashTitle,
      easy_paisa_number: settings.easyPaisaNumber,
      easy_paisa_title: settings.easyPaisaTitle,
      subscription_fee: Number(settings.subscriptionFee)
    }

    const { error } = await supabase.from('settings').upsert([payload])
    return !error
  } catch (e) {
    console.error('[Supabase] updateSettings error:', e)
    return false
  }
}

// ── Fetch & Generate Licenses in Supabase ────────────────────────────────────
export async function fetchSupabaseLicenses() {
  try {
    const { data, error } = await supabase.from('licenses').select('*').order('created_at', { ascending: false })
    if (data && !error) {
      return data.map(d => ({
        key: d.key,
        type: d.type,
        createdAt: d.created_at ? new Date(d.created_at).toLocaleDateString() : 'N/A',
        status: d.status,
        user_id: d.user_id
      }))
    }
  } catch (e) {
    console.warn('[Supabase] fetchLicenses error:', e)
  }
  return []
}

export async function generateSupabaseLicense(type = '1 Month', userId = null) {
  const part1 = Math.random().toString(36).substring(2, 6).toUpperCase()
  const part2 = Math.random().toString(36).substring(2, 6).toUpperCase()
  const key = `LESE-${part1}-${part2}`

  const expiresAt = new Date()
  if (type === '6 Months') expiresAt.setMonth(expiresAt.getMonth() + 6)
  else if (type === 'Lifetime') expiresAt.setFullYear(expiresAt.getFullYear() + 50)
  else expiresAt.setMonth(expiresAt.getMonth() + 1)

  const payload = {
    key,
    user_id: userId,
    type,
    created_at: new Date().toISOString(),
    expires_at: expiresAt.toISOString(),
    status: 'Active'
  }

  try {
    const { data, error } = await supabase.from('licenses').insert([payload]).select().single()
    if (data && !error) {
      return {
        key: data.key,
        user_id: data.user_id,
        type: data.type,
        createdAt: data.created_at ? new Date(data.created_at).toLocaleDateString() : 'N/A',
        status: data.status
      }
    }
  } catch (e) {
    console.error('[Supabase] generateLicense error:', e)
  }

  return { key, type, createdAt: new Date().toLocaleDateString(), status: 'Active' }
}

// ── Fetch & Manage Payments in Supabase ──────────────────────────────────────
export async function fetchSupabasePayments() {
  try {
    const { data, error } = await supabase.from('payments').select('*').order('created_at', { ascending: false })
    if (data && !error) {
      return data.map(p => ({
        id: p.id,
        user_id: p.user_id,
        phone: p.phone,
        trxId: p.trx_id,
        provider: p.provider,
        amount: p.amount,
        status: p.status,
        date: p.date,
        generatedKey: p.generated_key
      }))
    }
  } catch (e) {
    console.warn('[Supabase] fetchPayments error:', e)
  }
  return []
}

export async function approveSupabasePayment(paymentId) {
  const part1 = Math.random().toString(36).substring(2, 6).toUpperCase()
  const part2 = Math.random().toString(36).substring(2, 6).toUpperCase()
  const key = `LESE-${part1}-${part2}`

  try {
    // 1. Fetch payment to obtain the student's user_id
    const { data: payment } = await supabase
      .from('payments')
      .select('user_id')
      .eq('id', paymentId)
      .single()

    const userId = payment?.user_id || null

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30) // 30 Days Access

    // 2. Update payment status to Approved
    await supabase.from('payments').update({ status: 'Approved', generated_key: key }).eq('id', paymentId)

    // 3. Insert license LINKED TO user_id
    await supabase.from('licenses').insert([{
      key,
      user_id: userId,
      type: '1 Month',
      status: 'Active',
      created_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString()
    }])

    return { success: true, key }
  } catch (e) {
    console.error('[Supabase] approvePayment error:', e)
  }
  return { success: false }
}

// ── Fetch & Publish Announcements in Supabase ───────────────────────────────
export async function fetchSupabaseAnnouncements() {
  try {
    const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    if (data && !error) {
      return data.map(a => ({
        id: a.id,
        title: a.title,
        message: a.message,
        date: a.date,
        version: a.version
      }))
    }
  } catch (e) {
    console.warn('[Supabase] fetchAnnouncements error:', e)
  }
  return []
}

export async function publishSupabaseAnnouncement(title, message, version = '2.1.0') {
  const payload = {
    id: `ann_${Date.now()}`,
    title,
    message,
    version,
    date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    created_at: new Date().toISOString()
  }

  try {
    const { data, error } = await supabase.from('announcements').insert([payload]).select().single()
    if (data && !error) return data
  } catch (e) {
    console.error('[Supabase] publishAnnouncement error:', e)
  }
  return payload
}

// ── Production Announcement Ticker CRUD ─────────────────────────────────────
export async function fetchSupabaseAnnouncementBar() {
  try {
    const { data, error } = await supabase
      .from('site_announcements')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (data && !error) {
      return {
        id: data.id || 'default_announcement',
        announcement_text: data.announcement_text || data.message || '',
        message: data.announcement_text || data.message || '',
        enabled: data.enabled !== undefined ? Boolean(data.enabled) : Boolean(data.is_active),
        is_active: data.enabled !== undefined ? Boolean(data.enabled) : Boolean(data.is_active),
        speed: data.speed || 'normal',
        background_color: data.background_color || '#d97706',
        text_color: data.text_color || '#ffffff',
        font_size: data.font_size || '14px',
        font_weight: data.font_weight || '600',
        pause_on_hover: data.pause_on_hover !== undefined ? Boolean(data.pause_on_hover) : true,
        loop: data.loop !== undefined ? Boolean(data.loop) : true,
        show_icon: data.show_icon !== undefined ? Boolean(data.show_icon) : true,
        icon: data.icon || '📢',
        link_url: data.link_url || '',
        updated_at: data.updated_at
      }
    }
  } catch (e) {
    console.warn('[Supabase] fetchAnnouncementBar error:', e)
  }

  return {
    id: 'default_announcement',
    announcement_text: '🎉 Welcome to LeseLampe! Read German books & tap any word for instant translations.',
    message: '🎉 Welcome to LeseLampe! Read German books & tap any word for instant translations.',
    enabled: true,
    is_active: true,
    speed: 'normal',
    background_color: '#d97706',
    text_color: '#ffffff',
    font_size: '14px',
    font_weight: '600',
    pause_on_hover: true,
    loop: true,
    show_icon: true,
    icon: '📢',
    link_url: ''
  }
}

export async function updateSupabaseAnnouncementBar(annData) {
  const textMsg = annData.announcement_text || annData.message || ''
  const isEnabled = annData.enabled !== undefined ? Boolean(annData.enabled) : Boolean(annData.is_active)

  const payload = {
    id: annData.id || 'default_announcement',
    announcement_text: textMsg,
    message: textMsg,
    enabled: isEnabled,
    is_active: isEnabled,
    speed: annData.speed || 'normal',
    background_color: annData.background_color || '#d97706',
    text_color: annData.text_color || '#ffffff',
    font_size: annData.font_size || '14px',
    font_weight: annData.font_weight || '600',
    pause_on_hover: annData.pause_on_hover !== undefined ? Boolean(annData.pause_on_hover) : true,
    loop: annData.loop !== undefined ? Boolean(annData.loop) : true,
    show_icon: annData.show_icon !== undefined ? Boolean(annData.show_icon) : true,
    icon: annData.icon || '📢',
    link_url: annData.link_url || '',
    updated_at: new Date().toISOString()
  }

  // Broadcast to localStorage for instant local sync across tabs
  try {
    localStorage.setItem('leselampe_announcement_live_config', JSON.stringify(payload))
  } catch (e) {}

  try {
    const { data, error } = await supabase
      .from('site_announcements')
      .upsert([payload], { onConflict: 'id' })
      .select()
      .single()

    if (!error) return { success: true, data }
  } catch (e) {
    console.error('[Supabase] updateAnnouncementBar error:', e)
  }

  return { success: true, data: payload }
}
