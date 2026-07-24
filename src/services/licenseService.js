// License & Payment Management Service

const KEYS_STORAGE_KEY = 'leselampe_activation_keys'
const SUBMISSIONS_STORAGE_KEY = 'leselampe_payment_submissions'
const PAYMENT_SETTINGS_KEY = 'leselampe_payment_settings'

// Default Payment Account Details
const DEFAULT_PAYMENT_SETTINGS = {
  jazzcashNumber: '0300-1234567',
  jazzcashTitle: 'Awais Alam',
  easypaisaNumber: '0300-1234567',
  easypaisaTitle: 'Awais Alam',
  feeAmount: 'Rs. 500 / Month'
}

// ── Payment Account Settings ──────────────────────────────────────────────────

export function getPaymentSettings() {
  try {
    const stored = localStorage.getItem(PAYMENT_SETTINGS_KEY)
    return stored ? JSON.parse(stored) : DEFAULT_PAYMENT_SETTINGS
  } catch {
    return DEFAULT_PAYMENT_SETTINGS
  }
}

export function savePaymentSettings(settings) {
  try {
    localStorage.setItem(PAYMENT_SETTINGS_KEY, JSON.stringify(settings))
  } catch (e) {
    console.error('[License] Error saving payment settings:', e)
  }
}

// ── License Keys ──────────────────────────────────────────────────────────────

export function getActivationKeys() {
  try {
    const stored = localStorage.getItem(KEYS_STORAGE_KEY)
    const list = stored ? JSON.parse(stored) : []
    // Always include master admin demo key
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
    type, // '1 Month', '6 Months', 'Lifetime'
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

  // Master passcode overrides
  if (clean === 'AWAISALAM' || clean === 'LESE-DEMO-VIP') return true

  const keys = getActivationKeys()
  const match = keys.find(k => k.code.toUpperCase() === clean)
  if (match) {
    // Mark as used
    match.used = true
    localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(keys))
    return true
  }

  return false
}

export function deleteActivationKey(code) {
  const keys = getActivationKeys()
  const updated = keys.filter(k => k.code.toUpperCase() !== code.toUpperCase())
  localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(updated))
}

// ── Payment Proof Submissions ─────────────────────────────────────────────────

export function getPaymentSubmissions() {
  try {
    const stored = localStorage.getItem(SUBMISSIONS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function submitPaymentProof({ phone, trxId, provider = 'JazzCash' }) {
  const list = getPaymentSubmissions()
  const newSubmission = {
    id: `sub_${Date.now()}`,
    phone: phone.trim(),
    trxId: trxId.trim().toUpperCase(),
    provider,
    submittedAt: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    status: 'Pending', // 'Pending', 'Approved', 'Rejected'
    generatedKey: ''
  }

  const updated = [newSubmission, ...list]
  localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(updated))
  return newSubmission
}

export function approveSubmission(id) {
  const list = getPaymentSubmissions()
  const keyObj = generateActivationKey('1 Month')

  const updated = list.map(item => {
    if (item.id === id) {
      return { ...item, status: 'Approved', generatedKey: keyObj.code }
    }
    return item
  })

  localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(updated))
  return keyObj
}

export function rejectSubmission(id) {
  const list = getPaymentSubmissions()
  const updated = list.map(item => item.id === id ? { ...item, status: 'Rejected' } : item)
  localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(updated))
}
