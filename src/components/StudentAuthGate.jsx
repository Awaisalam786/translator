import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { BookOpen, ShieldCheck, Mail, Lock, ArrowRight, RefreshCw, CheckCircle2, Clock, DollarSign, AlertCircle } from 'lucide-react'
import { getPaymentSettings } from '../services/licenseService'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://xyzcompany.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_key'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export default function StudentAuthGate({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authMode, setAuthMode] = useState('login') // 'login' | 'signup' | 'forgot'

  // Form Inputs
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signupFullName, setSignupFullName] = useState('')
  const [signupPhone, setSignupPhone] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Access State
  const [trialDaysLeft, setTrialDaysLeft] = useState(3)
  const [hasActiveAccess, setHasActiveAccess] = useState(false)
  const [checkingAccess, setCheckingAccess] = useState(true)
  const [userProfile, setUserProfile] = useState(null)

  // Payment Proof Form
  const [phone, setPhone] = useState('')
  const [trxId, setTrxId] = useState('')
  const [provider, setProvider] = useState('JazzCash')
  const [submittingPayment, setSubmittingPayment] = useState(false)
  const [paymentSubmitted, setPaymentSubmitted] = useState(false)

  const paymentSettings = getPaymentSettings()

  // Save Profile (Full Name & Phone Number) to public.profiles
  const handleSaveProfile = async ({ full_name, phone_number }) => {
    if (!session?.user) return false
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name, phone_number })
        .eq('id', session.user.id)

      if (!error) {
        console.log('[Profile] Saved full_name and phone_number for user_id:', session.user.id)
        setUserProfile(prev => ({ ...prev, full_name, phone_number }))
        return true
      }
      console.error('[AuthGate] Error updating profile:', error)
    } catch (e) {
      console.error('[AuthGate] handleSaveProfile exception:', e)
    }
    return false
  }

  // Save Full Name to public.profiles
  const handleSaveName = async (newName) => {
    if (!session?.user) return false
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: newName })
        .eq('id', session.user.id)

      if (!error) {
        setUserProfile(prev => ({ ...prev, full_name: newName }))
        return true
      }
      console.error('[AuthGate] Error updating full_name:', error)
    } catch (e) {
      console.error('[AuthGate] handleSaveName exception:', e)
    }
    return false
  }

  useEffect(() => {
    // Check initial auth session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        verifyUserTrialAndAccess(session.user)
      } else {
        setLoading(false)
        setCheckingAccess(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        verifyUserTrialAndAccess(session.user)
      } else {
        setHasActiveAccess(false)
        setUserProfile(null)
        setLoading(false)
        setCheckingAccess(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Verify 3-Day Trial & License Status
  const verifyUserTrialAndAccess = async (user) => {
    setCheckingAccess(true)
    console.log('[AuthGate] Verifying trial & access for User ID:', user.id, 'Email:', user.email)
    try {
      // 1. Fetch Profile for trial_started_at & full_name
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUserProfile(profile)
      }

      const trialStart = profile?.trial_started_at ? new Date(profile.trial_started_at) : new Date()
      const now = new Date()
      const diffTime = now.getTime() - trialStart.getTime()
      const diffDays = diffTime / (1000 * 3600 * 24)

      const remaining = Math.max(0, Math.ceil(3 - diffDays))
      setTrialDaysLeft(remaining)
      console.log('[AuthGate] Trial Started At:', profile?.trial_started_at, '| Days Elapsed:', diffDays.toFixed(2), '| Remaining:', remaining)

      // 2. Check for active license linked to this user_id
      const { data: userLicenses, error: licErr } = await supabase
        .from('licenses')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'Active')

      if (licErr) {
        console.error('[AuthGate] License query error:', licErr)
      }

      console.log('[AuthGate] Licenses found for user_id:', userLicenses)

      // Filter valid non-expired licenses
      const validLicense = userLicenses?.find(lic => {
        if (!lic.expires_at) return true
        return new Date(lic.expires_at) > now
      })

      const hasLicense = Boolean(validLicense)
      console.log('[AuthGate] Has Valid Active License?:', hasLicense, '| Valid License Object:', validLicense)

      // Access granted if within 3-day trial OR has active license
      if (diffDays <= 3 || hasLicense) {
        console.log('[AuthGate] ✅ ACCESS GRANTED!')
        setHasActiveAccess(true)
      } else {
        console.warn('[AuthGate] ❌ ACCESS BLOCKED (Trial Expired & No Active License found for user_id)')
        setHasActiveAccess(false)
      }
    } catch (e) {
      console.warn('[AuthGate] Fallback to open access:', e)
      setHasActiveAccess(true)
    } finally {
      setLoading(false)
      setCheckingAccess(false)
    }
  }

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setErrorMsg(error.message)
      setLoading(false)
    }
  }

  // Handle Sign Up
  const handleSignUp = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: signupFullName.trim(),
          phone_number: signupPhone.trim()
        }
      }
    })

    if (error) {
      setErrorMsg(error.message)
      setLoading(false)
    } else {
      if (data?.user) {
        console.log('[Signup] Saved full_name and phone_number for user_id:', data.user.id, '| Full Name:', signupFullName.trim(), '| Phone:', signupPhone.trim())
        try {
          await supabase.from('profiles').upsert([{
            id: data.user.id,
            email: data.user.email,
            full_name: signupFullName.trim(),
            phone_number: signupPhone.trim(),
            trial_started_at: new Date().toISOString()
          }])
        } catch (err) {
          console.warn('[Signup] Profile upsert warning:', err)
        }
      }
      setSuccessMsg('Account created successfully! Enjoy your 3-Day Free Trial.')
      setLoading(false)
    }
  }

  // Handle Google OAuth Sign In
  const handleGoogleSignIn = async () => {
    setErrorMsg('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })
    if (error) setErrorMsg(error.message)
  }

  // Handle Password Reset
  const handleForgot = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) {
      setErrorMsg(error.message)
    } else {
      setSuccessMsg('Password reset link sent to your email!')
    }
  }

  // Submit Payment Proof
  const handlePaymentSubmit = async (e) => {
    e.preventDefault()
    if (!phone || !trxId || !session?.user) return
    setSubmittingPayment(true)

    try {
      const newPayment = {
        id: `trx_${Date.now()}`,
        user_id: session.user.id,
        phone,
        trx_id: trxId,
        provider,
        amount: 500,
        status: 'Pending',
        date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      }

      await supabase.from('payments').insert([newPayment])
      setPaymentSubmitted(true)
    } catch (e) {
      console.error('[Payment] Submit error:', e)
    } finally {
      setSubmittingPayment(false)
    }
  }

  // Handle Sign Out
  const handleSignOut = async () => {
    console.log('[SignOut] button clicked, initiating Supabase auth sign-out...')
    setLoading(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('[SignOut] Error signing out from Supabase:', error.message)
      } else {
        console.log('[SignOut] supabase.auth.signOut() completed successfully')
      }
    } catch (err) {
      console.error('[SignOut] Unexpected sign-out exception:', err)
    } finally {
      setSession(null)
      setHasActiveAccess(false)
      setCheckingAccess(false)
      setLoading(false)
      console.log('[SignOut] Auth state reset. Reloading app state...')
      window.location.reload()
    }
  }

  // ── 1. LOADING SCREEN ───────────────────────────────────────────────────────
  if (loading || checkingAccess) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0f121d', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        <RefreshCw size={28} className="spin" color="#d97706" style={{ marginRight: '10px' }} />
        <span>Loading Leselampe Reader...</span>
      </div>
    )
  }

  // ── 2. LOGIN / SIGNUP / FORGOT PASSWORD SCREEN ───────────────────────────────
  if (!session) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0f121d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'radial-gradient(ellipse at top, #1a1d2e 0%, #0f121d 75%)'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#1a1d2e',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '20px',
          padding: '36px 28px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
        }}>
          {/* Header Brand */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '16px',
              background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff',
              margin: '0 auto 14px', boxShadow: '0 8px 24px rgba(217, 119, 6, 0.35)'
            }}>
              <BookOpen size={28} />
            </div>

            <h1 style={{ fontFamily: '"Merriweather", serif', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 4px 0', color: '#f8fafc' }}>
              Leselampe Reader<span style={{ color: '#d97706' }}>.</span>
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
              Foreign Language Reader with 3-Day Free Trial
            </p>
          </div>

          {/* Mode Switcher */}
          <div style={{ display: 'flex', backgroundColor: '#12151e', borderRadius: '10px', padding: '4px', marginBottom: '20px' }}>
            <button
              onClick={() => { setAuthMode('login'); setErrorMsg(''); setSuccessMsg('') }}
              style={{
                flex: 1, padding: '8px', border: 'none', borderRadius: '8px',
                backgroundColor: authMode === 'login' ? '#d97706' : 'transparent',
                color: authMode === 'login' ? '#fff' : '#94a3b8',
                fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer'
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => { setAuthMode('signup'); setErrorMsg(''); setSuccessMsg('') }}
              style={{
                flex: 1, padding: '8px', border: 'none', borderRadius: '8px',
                backgroundColor: authMode === 'signup' ? '#d97706' : 'transparent',
                color: authMode === 'signup' ? '#fff' : '#94a3b8',
                fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer'
              }}
            >
              Start Free Trial
            </button>
          </div>

          {errorMsg && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '10px 14px', color: '#ef4444', fontSize: '0.82rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '10px 14px', color: '#10b981', fontSize: '0.82rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              marginBottom: '16px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>OR</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
          </div>

          {/* Login Form */}
          {authMode === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="student@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={() => setAuthMode('forgot')}
                  style={{ background: 'none', border: 'none', color: '#d97706', fontSize: '0.78rem', cursor: 'pointer' }}
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#d97706', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <span>Sign In to Reader</span>
                <ArrowRight size={18} />
              </button>
            </form>
          )}

          {/* Sign Up Form */}
          {authMode === 'signup' && (
            <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ahmed Khan"
                  value={signupFullName}
                  onChange={(e) => setSignupFullName(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Mobile Number (Optional)</label>
                <input
                  type="text"
                  placeholder="0300-1234567"
                  value={signupPhone}
                  onChange={(e) => setSignupPhone(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="student@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Password (min 6 chars) *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <button
                type="submit"
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#10b981', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <span>Start 3-Day Free Trial</span>
                <ArrowRight size={18} />
              </button>
            </form>
          )}

          {/* Forgot Password */}
          {authMode === 'forgot' && (
            <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Enter Your Email</label>
                <input
                  type="email"
                  required
                  placeholder="student@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <button
                type="submit"
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#d97706', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Send Reset Link
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  // ── 3. TRIAL EXPIRED PAYWALL SCREEN ─────────────────────────────────────────
  if (!hasActiveAccess) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0f121d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'radial-gradient(ellipse at top, #1a1d2e 0%, #0f121d 75%)'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#1a1d2e',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '20px',
          padding: '36px 28px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '16px',
              backgroundColor: 'rgba(245, 158, 11, 0.2)', border: '1px solid #f59e0b',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b',
              margin: '0 auto 14px'
            }}>
              <Clock size={28} />
            </div>

            <h1 style={{ fontFamily: '"Merriweather", serif', fontSize: '1.5rem', fontWeight: 700, margin: '0 0 6px 0', color: '#f8fafc' }}>
              Your 3-Day Free Trial Has Ended
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
              Subscribe to unlock full access to Leselampe Reader
            </p>
          </div>

          {/* Payment Account Details */}
          <div style={{ backgroundColor: '#12151e', borderRadius: '12px', padding: '16px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f59e0b', marginBottom: '10px' }}>
              Payment Methods ({paymentSettings.feeAmount})
            </div>
            <div style={{ fontSize: '0.82rem', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>📱 <strong>JazzCash</strong>: {paymentSettings.jazzcashNumber} ({paymentSettings.jazzcashTitle})</div>
              <div>📱 <strong>EasyPaisa</strong>: {paymentSettings.easypaisaNumber} ({paymentSettings.easypaisaTitle})</div>
            </div>
          </div>

          {paymentSubmitted ? (
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', borderRadius: '12px', padding: '20px', textAlign: 'center', color: '#10b981' }}>
              <CheckCircle2 size={32} style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>Payment Proof Submitted!</div>
              <div style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>
                Your payment is currently pending approval by the Admin. Once verified, your reader will be unlocked automatically.
              </div>
            </div>
          ) : (
            <form onSubmit={handlePaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Payment Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none' }}
                >
                  <option value="JazzCash">JazzCash</option>
                  <option value="EasyPaisa">EasyPaisa</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Your Sender Mobile Number</label>
                <input
                  type="text"
                  required
                  placeholder="0300-1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Transaction ID (TRX ID)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9876543210"
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <button
                type="submit"
                disabled={submittingPayment}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#d97706', color: '#fff', fontWeight: 700, cursor: 'pointer', marginTop: '6px' }}
              >
                {submittingPayment ? 'Submitting Proof...' : 'Submit Payment Proof'}
              </button>
            </form>
          )}

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button
              onClick={handleSignOut}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Sign out of account
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── 4. UNLOCKED READER VIEW WITH TRIAL BADGE ───────────────────────────────
  return (
    <div>
      {/* Top Banner indicating trial days remaining */}
      {trialDaysLeft > 0 && (
        <div style={{
          backgroundColor: '#d97706',
          color: '#ffffff',
          fontSize: '0.78rem',
          fontWeight: 700,
          padding: '4px 12px',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }}>
          <Clock size={14} />
          <span>Free Trial Active: {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} remaining</span>
        </div>
      )}
      {React.isValidElement(children)
        ? React.cloneElement(children, { onSignOut: handleSignOut, userProfile, onSaveProfile: handleSaveProfile, onSaveName: handleSaveName })
        : children}
    </div>
  )
}
