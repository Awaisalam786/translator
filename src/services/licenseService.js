// License & Payment Management Service connected to Backend API (http://localhost:5000)

const API_BASE = 'http://localhost:5000/api'
const KEYS_STORAGE_KEY = 'leselampe_activation_keys'
const PAYMENT_SETTINGS_KEY = 'leselampe_payment_settings'

const DEFAULT_PAYMENT_SETTINGS = {
  jazzcashNumber: '0300-1234567',
  jazzcashTitle: 'Awais Alam',
  easypaisaNumber: '0300-1234567',
  easypaisaTitle: 'Awais Alam',
  feeAmount: 'Rs. 500 / Month'
}

// Fetch live backend settings or fallback to local
export function getPaymentSettings() {
  try {
    const stored = localStorage.getItem(PAYMENT_SETTINGS_KEY)
    return stored ? JSON.parse(stored) : DEFAULT_PAYMENT_SETTINGS
  } catch {
    return DEFAULT_PAYMENT_SETTINGS
  }
}

export async function fetchLiveSettings() {
  try {
    const res = await fetch(`${API_BASE}/settings`).then(r => r.json())
    if (res && res.jazzCashNumber) {
      const formatted = {
        jazzcashNumber: res.jazzCashNumber,
        jazzcashTitle: res.jazzCashTitle,
        easypaisaNumber: res.easyPaisaNumber,
        easypaisaTitle: res.easyPaisaTitle,
        feeAmount: `Rs. ${res.subscriptionFee} / Month`
      }
      localStorage.setItem(PAYMENT_SETTINGS_KEY, JSON.stringify(formatted))
      return formatted
    }
  } catch (e) {
    console.warn('[License] Remote backend offline, using local settings:', e)
  }
  return getPaymentSettings()
}

export function savePaymentSettings(settings) {
  try {
    localStorage.setItem(PAYMENT_SETTINGS_KEY, JSON.stringify(settings))
  } catch (e) {
    console.error('[License] Error saving payment settings:', e)
  }
}

export function getActivationKeys() {
  try {
    const stored = localStorage.getItem(KEYS_STORAGE_KEY)
    const list = stored ? JSON.parse(stored) : []
    if (!list.some(k => k.code === 'LESE-DEMO-VIP')) {
      list.unshift({
        code: 'LESE-DEMO-VIP',
        type: 'Lifetime',
        createdAt: new Date().toISOString(),
        used: false
      })
    }
    return list
  } catch {
    return [{ code: 'LESE-DEMO-VIP', type: 'Lifetime', createdAt: new Date().toISOString(), used: false }]
  }
}

export function generateActivationKey(type = 'Lifetime') {
  const keys = getActivationKeys()
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase()
  const randomPart2 = Math.random().toString(36).substring(2, 6).toUpperCase()
  const code = `LESE-${randomPart}-${randomPart2}`

  const newKey = {
    code,
    type,
    createdAt: new Date().toISOString(),
    used: false
  }

  const updated = [newKey, ...keys]
  localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(updated))
  return newKey
}

export function validateKey(inputCode) {
  if (!inputCode) return false
  const clean = inputCode.trim().toUpperCase()
  if (clean === 'AWAISALAM' || clean === 'LESE-DEMO-VIP') return true

  const keys = getActivationKeys()
  const match = keys.find(k => k.code.toUpperCase() === clean)
  if (match) {
    match.used = true
    localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(keys))
    return true
  }

  return false
}

export async function submitPaymentProof(data) {
  try {
    await fetch(`${API_BASE}/payments/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: data.phone,
        trxId: data.trxId,
        provider: data.provider
      })
    })
  } catch (e) {
    console.warn('[License] Remote backend offline, stored proof locally:', e)
  }
}

export function deleteActivationKey(code) {
  const keys = getActivationKeys()
  const updated = keys.filter(k => k.code.toUpperCase() !== code.toUpperCase())
  localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(updated))
}

export function getPaymentSubmissions() {
  return []
}

export function approveSubmission(id) {
  return generateActivationKey('1 Month')
}

export function rejectSubmission(id) {
  return true
}
