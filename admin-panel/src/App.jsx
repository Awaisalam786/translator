import React, { useState, useEffect } from 'react'
import {
  ShieldCheck, Key, CreditCard, Settings, Megaphone, CheckCircle2, XCircle,
  Copy, Check, Plus, RefreshCw, DollarSign, Users, LogOut, ArrowRight, Database,
  TrendingUp, Activity, Search, Trash2, Lock, UserCheck, ShieldAlert, BarChart2
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

import {
  fetchSupabaseSettings, updateSupabaseSettings,
  fetchSupabaseLicenses, generateSupabaseLicense,
  fetchSupabasePayments, approveSupabasePayment,
  fetchSupabaseAnnouncements, publishSupabaseAnnouncement,
  fetchSupabaseAnnouncementBar, updateSupabaseAnnouncementBar,
  fetchSupabaseProfiles, deleteUserAccount,
  getSupabaseCredentials, configureSupabase,
  supabaseAdminLogin, supabaseAdminLogout, getSupabaseUser
} from './services/supabaseService'

const usageTrendData = [
  { day: 'Mon', revenue: 1500, signups: 4, translations: 120 },
  { day: 'Tue', revenue: 2000, signups: 6, translations: 190 },
  { day: 'Wed', revenue: 1000, signups: 3, translations: 140 },
  { day: 'Thu', revenue: 3500, signups: 9, translations: 280 },
  { day: 'Fri', revenue: 2500, signups: 7, translations: 230 },
  { day: 'Sat', revenue: 4000, signups: 12, translations: 340 },
  { day: 'Sun', revenue: 3000, signups: 8, translations: 290 }
]

export default function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

  const [activeTab, setActiveTab] = useState('analytics')
  const [loading, setLoading] = useState(false)
  const [copiedKey, setCopiedKey] = useState(null)
  const [saveStatus, setSaveStatus] = useState('')
  const [userSearch, setUserSearch] = useState('')

  const [usersList, setUsersList] = useState([])
  const [licenses, setLicenses] = useState([])
  const [payments, setPayments] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [settings, setSettings] = useState({
    jazzCashNumber: '0300-1234567',
    jazzCashTitle: 'Awais Alam',
    easyPaisaNumber: '0300-1234567',
    easyPaisaTitle: 'Awais Alam',
    subscriptionFee: 500
  })

  const [keyType, setKeyType] = useState('1 Month')
  const [annTitle, setAnnTitle] = useState('')
  const [annMessage, setAnnMessage] = useState('')
  const [annVersion, setAnnVersion] = useState('2.1.0')

  const [annBar, setAnnBar] = useState({
    id: 'default_announcement',
    message: '🎉 Welcome to LeseLampe! Read German books & tap any word for instant translations.',
    is_active: true,
    background_color: '#d97706',
    text_color: '#ffffff',
    link_url: '',
    is_scrolling: false
  })
  const [annBarSaveMsg, setAnnBarSaveMsg] = useState('')

  useEffect(() => {
    checkSession()
  }, [])

  const checkSession = async () => {
    const user = await getSupabaseUser()
    if (user) {
      setCurrentUser(user)
      setAuthenticated(true)
      fetchAllData()
    }
  }

  const fetchAllData = async () => {
    setLoading(true)

    const [supSet, supLic, supPay, supAnn, supPro, supBar] = await Promise.all([
      fetchSupabaseSettings(),
      fetchSupabaseLicenses(),
      fetchSupabasePayments(),
      fetchSupabaseAnnouncements(),
      fetchSupabaseProfiles(),
      fetchSupabaseAnnouncementBar()
    ])

    if (supSet) setSettings(supSet)
    if (supLic) setLicenses(supLic)
    if (supPay) setPayments(supPay)
    if (supAnn) setAnnouncements(supAnn)
    if (supPro) setUsersList(supPro)
    if (supBar) setAnnBar(supBar)

    setLoading(false)
  }

  const handleSaveAnnouncementBar = async (e) => {
    e.preventDefault()
    setAnnBarSaveMsg('Saving announcement bar...')
    const res = await updateSupabaseAnnouncementBar(annBar)
    if (res.success) {
      setAnnBarSaveMsg('✅ Announcement Bar updated live!')
      setTimeout(() => setAnnBarSaveMsg(''), 4000)
    } else {
      setAnnBarSaveMsg('❌ Error updating announcement bar')
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setAuthError('')

    // 1. Attempt Supabase Auth login with email & password
    const res = await supabaseAdminLogin(email, password)
    if (res.success) {
      setCurrentUser(res.user)
      setAuthenticated(true)
      fetchAllData()
      return
    }

    // 2. Master Admin override check (allows rs03165162@gmail.com, master password 'awaisalam', or admin emails)
    if (
      password === 'awaisalam' || 
      email.toLowerCase().includes('admin') || 
      email.toLowerCase() === 'rs03165162@gmail.com'
    ) {
      setCurrentUser({ email: email || 'rs03165162@gmail.com' })
      setAuthenticated(true)
      fetchAllData()
      return
    }

    setAuthError(res.error || 'Invalid credentials or non-admin account.')
  }

  const handleLogout = async () => {
    await supabaseAdminLogout()
    setAuthenticated(false)
    setCurrentUser(null)
  }

  const handleGenerateKey = async () => {
    const newLic = await generateSupabaseLicense(keyType)
    setLicenses(prev => [newLic, ...prev])
    setCopiedKey(newLic.key)
    setTimeout(() => setCopiedKey(null), 3000)
  }

  const handleApprovePayment = async (paymentId) => {
    await approveSupabasePayment(paymentId)
    fetchAllData()
  }

  const handleSaveSettings = async (e) => {
    e.preventDefault()
    const ok = await updateSupabaseSettings(settings)
    setSaveStatus(ok ? 'Settings updated successfully!' : 'Saved to Local Store!')
    setTimeout(() => setSaveStatus(''), 3000)
  }

  const handlePublishAnnouncement = async (e) => {
    e.preventDefault()
    if (!annTitle.trim() || !annMessage.trim()) return

    const published = await publishSupabaseAnnouncement(annTitle, annMessage, annVersion)
    setAnnouncements(prev => [published, ...prev])
    setAnnTitle('')
    setAnnMessage('')
  }

  const handleCopyKey = (keyText) => {
    navigator.clipboard.writeText(keyText)
    setCopiedKey(keyText)
    setTimeout(() => setCopiedKey(null), 2500)
  }

  if (!authenticated) {
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
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #3ecf8e 0%, #10b981 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            margin: '0 auto 16px',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)'
          }}>
            <ShieldCheck size={30} />
          </div>

          <h1 style={{ fontFamily: '"Merriweather", serif', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 6px 0', color: '#f8fafc' }}>
            Leselampe Admin Portal<span style={{ color: '#10b981' }}>.</span>
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 24px 0' }}>
            Standalone Supabase RBAC Management Control Panel
          </p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input
              type="email"
              placeholder="Admin Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: '#12151e',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#f8fafc',
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />

            <input
              type="password"
              placeholder="Password (Default: awaisalam)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: '#12151e',
                border: authError ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                color: '#f8fafc',
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />

            {authError && (
              <div style={{ fontSize: '0.8rem', color: '#ef4444' }}>
                {authError}
              </div>
            )}

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#10b981',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
              }}
            >
              <span>Login to Dashboard</span>
              <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </div>
    )
  }

  const handleDeleteUser = async (userId, userEmail) => {
    if (window.confirm(`Are you sure you want to delete user ${userEmail}? This cannot be undone.`)) {
      setLoading(true)
      const res = await deleteUserAccount(userId)
      if (res.success) {
        setUsersList(prev => prev.filter(u => u.id !== userId))
      } else {
        alert(res.error || 'Failed to delete user.')
      }
      setLoading(false)
    }
  }

  const pendingCount = payments.filter(p => p.status === 'Pending').length
  const totalRevenue = payments.filter(p => p.status === 'Approved').reduce((acc, p) => acc + (p.amount || 500), 0)
  const filteredUsers = usersList.filter(u => u.email.toLowerCase().includes(userSearch.toLowerCase()))

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f121d', color: '#e2e8f0', display: 'flex' }}>
      <aside style={{
        width: '240px',
        backgroundColor: '#1a1d2e',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px', paddingLeft: '8px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #3ecf8e 0%, #10b981 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
            }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <div style={{ fontFamily: '"Merriweather", serif', fontWeight: 700, fontSize: '1.1rem', color: '#f8fafc' }}>
                Leselampe
              </div>
              <div style={{ fontSize: '0.72rem', color: '#3ecf8e' }}>Admin Portal</div>
            </div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              onClick={() => setActiveTab('analytics')}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px',
                backgroundColor: activeTab === 'analytics' ? '#10b981' : 'transparent',
                color: activeTab === 'analytics' ? '#ffffff' : '#94a3b8',
                border: 'none', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', textAlign: 'left'
              }}
            >
              <BarChart2 size={18} />
              <span>Analytics</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px',
                backgroundColor: activeTab === 'users' ? '#10b981' : 'transparent',
                color: activeTab === 'users' ? '#ffffff' : '#94a3b8',
                border: 'none', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', textAlign: 'left'
              }}
            >
              <Users size={18} />
              <span>User Management</span>
            </button>

            <button
              onClick={() => setActiveTab('payments')}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px',
                backgroundColor: activeTab === 'payments' ? '#10b981' : 'transparent',
                color: activeTab === 'payments' ? '#ffffff' : '#94a3b8',
                border: 'none', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', textAlign: 'left'
              }}
            >
              <CreditCard size={18} />
              <span>Payments {pendingCount > 0 && <span style={{ backgroundColor: '#f59e0b', color: '#000', borderRadius: '10px', padding: '1px 6px', fontSize: '0.72rem' }}>{pendingCount}</span>}</span>
            </button>

            <button
              onClick={() => setActiveTab('licenses')}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px',
                backgroundColor: activeTab === 'licenses' ? '#10b981' : 'transparent',
                color: activeTab === 'licenses' ? '#ffffff' : '#94a3b8',
                border: 'none', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', textAlign: 'left'
              }}
            >
              <Key size={18} />
              <span>Activation Keys</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px',
                backgroundColor: activeTab === 'settings' ? '#10b981' : 'transparent',
                color: activeTab === 'settings' ? '#ffffff' : '#94a3b8',
                border: 'none', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', textAlign: 'left'
              }}
            >
              <Settings size={18} />
              <span>Account & Pricing</span>
            </button>

            <button
              onClick={() => setActiveTab('announcements')}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px',
                backgroundColor: activeTab === 'announcements' ? '#10b981' : 'transparent',
                color: activeTab === 'announcements' ? '#ffffff' : '#94a3b8',
                border: 'none', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', textAlign: 'left'
              }}
            >
              <Megaphone size={18} />
              <span>Announcements</span>
            </button>
          </nav>
        </div>

        <div style={{ paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Logged in as:<br /><strong style={{ color: '#e2e8f0' }}>{currentUser?.email}</strong>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)',
              backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.82rem'
            }}
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: '32px 36px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 4px 0', color: '#f8fafc' }}>
              {activeTab === 'analytics' && 'Analytics & Usage Trends'}
              {activeTab === 'users' && 'User Management & RBAC Roles'}
              {activeTab === 'payments' && 'Payment Submissions & Approvals'}
              {activeTab === 'licenses' && 'Activation Keys Database'}
              {activeTab === 'settings' && 'Payment Account & Fee Settings'}
              {activeTab === 'announcements' && 'App Broadcasts & Notices'}
            </h2>
            <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
              Connected to Supabase Cloud Database with RBAC Security Policies
            </div>
          </div>

          <button
            onClick={fetchAllData}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', color: '#f8fafc', padding: '8px 14px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              <div style={{ backgroundColor: '#1a1d2e', borderRadius: '14px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Total Approved Revenue</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#3ecf8e' }}>Rs. {totalRevenue.toLocaleString()}</div>
              </div>
              <div style={{ backgroundColor: '#1a1d2e', borderRadius: '14px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Total Registered Users</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#38bdf8' }}>{usersList.length}</div>
              </div>
              <div style={{ backgroundColor: '#1a1d2e', borderRadius: '14px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Active License Keys</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f59e0b' }}>{licenses.length}</div>
              </div>
              <div style={{ backgroundColor: '#1a1d2e', borderRadius: '14px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Pending Approvals</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: pendingCount > 0 ? '#ef4444' : '#10b981' }}>{pendingCount}</div>
              </div>
            </div>

            <div style={{ backgroundColor: '#1a1d2e', borderRadius: '14px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#f8fafc' }}>Weekly Revenue & Word Lookup Volume</h3>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={usageTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="day" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff' }} />
                    <Area type="monotone" dataKey="revenue" stroke="#3ecf8e" fill="rgba(62, 207, 142, 0.2)" name="Revenue (PKR)" />
                    <Area type="monotone" dataKey="translations" stroke="#38bdf8" fill="rgba(56, 189, 248, 0.1)" name="Translations" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div style={{ backgroundColor: '#1a1d2e', borderRadius: '14px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>Registered Users & RBAC Roles</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '6px 12px' }}>
                <Search size={16} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Search user email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                    <th style={{ padding: '12px' }}>User Email</th>
                    <th style={{ padding: '12px' }}>RBAC Role</th>
                    <th style={{ padding: '12px' }}>Created Date</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px', fontWeight: 600, color: '#f8fafc' }}>{u.email}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                          backgroundColor: u.role === 'admin' ? 'rgba(62, 207, 142, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                          color: u.role === 'admin' ? '#3ecf8e' : '#38bdf8'
                        }}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: '#94a3b8' }}>{u.created_at}</td>
                      <td style={{ padding: '12px', color: '#10b981' }}>{u.status}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleDeleteUser(u.id, u.email)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                          title="Delete User Account"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div style={{ backgroundColor: '#1a1d2e', borderRadius: '14px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#f8fafc' }}>JazzCash & EasyPaisa Payment Submissions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {payments.map((p) => (
                <div
                  key={p.id}
                  style={{
                    backgroundColor: '#12151e', borderRadius: '10px', padding: '16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    border: p.status === 'Pending' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255,255,255,0.06)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '1rem' }}>{p.provider} · Rs. {p.amount}</span>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                        padding: '2px 8px', borderRadius: '6px',
                        backgroundColor: p.status === 'Approved' ? 'rgba(16, 185, 129, 0.2)' : p.status === 'Pending' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: p.status === 'Approved' ? '#10b981' : p.status === 'Pending' ? '#f59e0b' : '#ef4444'
                      }}>
                        {p.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                      Sender Phone: <strong style={{ color: '#e2e8f0' }}>{p.phone}</strong> | TRX ID: <strong style={{ color: '#f59e0b' }}>{p.trxId}</strong> | Date: {p.date}
                    </div>
                  </div>

                  {p.status === 'Pending' && (
                    <button
                      onClick={() => handleApprovePayment(p.id)}
                      style={{
                        backgroundColor: '#10b981', border: 'none', borderRadius: '6px',
                        color: '#fff', padding: '6px 14px', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem'
                      }}
                    >
                      <CheckCircle2 size={15} />
                      <span>Approve & Issue Key</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'licenses' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ backgroundColor: '#1a1d2e', borderRadius: '14px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#f8fafc' }}>Generate New Activation Key</h3>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <select
                  value={keyType}
                  onChange={(e) => setKeyType(e.target.value)}
                  style={{
                    padding: '10px 14px', borderRadius: '8px', backgroundColor: '#12151e',
                    border: '1px solid rgba(255,255,255,0.15)', color: '#f8fafc', outline: 'none'
                  }}
                >
                  <option value="1 Month">1 Month Access</option>
                  <option value="6 Months">6 Months Access</option>
                  <option value="Lifetime">Lifetime Access</option>
                </select>

                <button
                  onClick={handleGenerateKey}
                  style={{
                    padding: '10px 20px', borderRadius: '8px', border: 'none',
                    backgroundColor: '#10b981', color: '#fff', fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Plus size={16} />
                  <span>Generate Key</span>
                </button>
              </div>
            </div>

            <div style={{ backgroundColor: '#1a1d2e', borderRadius: '14px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#f8fafc' }}>Activation Keys Database</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {licenses.map((lic, idx) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: '#12151e', borderRadius: '10px', padding: '12px 16px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}
                  >
                    <div>
                      <span style={{ fontFamily: 'monospace', fontSize: '1.05rem', fontWeight: 700, color: '#3ecf8e', marginRight: '12px' }}>
                        {lic.key}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8', backgroundColor: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '6px' }}>
                        {lic.type}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopyKey(lic.key)}
                      style={{
                        background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px',
                        color: '#f8fafc', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem'
                      }}
                    >
                      {copiedKey === lic.key ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      <span>{copiedKey === lic.key ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} style={{ backgroundColor: '#1a1d2e', borderRadius: '14px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>Payment Accounts & Subscription Pricing</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>JazzCash Account Number</label>
                <input
                  type="text"
                  value={settings.jazzCashNumber}
                  onChange={(e) => setSettings({ ...settings, jazzCashNumber: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>JazzCash Account Title</label>
                <input
                  type="text"
                  value={settings.jazzCashTitle}
                  onChange={(e) => setSettings({ ...settings, jazzCashTitle: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>EasyPaisa Account Number</label>
                <input
                  type="text"
                  value={settings.easyPaisaNumber}
                  onChange={(e) => setSettings({ ...settings, easyPaisaNumber: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>EasyPaisa Account Title</label>
                <input
                  type="text"
                  value={settings.easyPaisaTitle}
                  onChange={(e) => setSettings({ ...settings, easyPaisaTitle: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Subscription Fee (PKR / Month)</label>
                <input
                  type="number"
                  value={settings.subscriptionFee}
                  onChange={(e) => setSettings({ ...settings, subscriptionFee: Number(e.target.value) })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none' }}
                />
              </div>
            </div>

            {saveStatus && <div style={{ color: '#10b981', fontSize: '0.85rem' }}>{saveStatus}</div>}

            <button
              type="submit"
              style={{
                width: '200px', padding: '10px', borderRadius: '8px', border: 'none',
                backgroundColor: '#10b981', color: '#fff', fontWeight: 700, cursor: 'pointer', marginTop: '8px'
              }}
            >
              Save Settings
            </button>
          </form>
        )}

        {activeTab === 'announcements' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* ── Production Announcement Ticker Control Panel ────────────── */}
            <form onSubmit={handleSaveAnnouncementBar} style={{ backgroundColor: '#1a1d2e', borderRadius: '14px', padding: '24px', border: '1px solid rgba(217,119,6,0.3)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Megaphone size={18} color="#d97706" />
                  <span>Production Announcement Ticker Settings</span>
                </h3>

                {/* Enabled ON/OFF Switch */}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={annBar.enabled !== undefined ? annBar.enabled : annBar.is_active}
                    onChange={(e) => setAnnBar({ ...annBar, enabled: e.target.checked, is_active: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: (annBar.enabled !== undefined ? annBar.enabled : annBar.is_active) ? '#10b981' : '#ef4444' }}>
                    {(annBar.enabled !== undefined ? annBar.enabled : annBar.is_active) ? 'Ticker Enabled (ON)' : 'Ticker Disabled (OFF)'}
                  </span>
                </label>
              </div>

              {/* Announcement Text */}
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Announcement Text</label>
                <textarea
                  rows={2}
                  placeholder="Enter message to scroll across top ticker..."
                  value={annBar.announcement_text || annBar.message || ''}
                  onChange={(e) => setAnnBar({ ...annBar, announcement_text: e.target.value, message: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none', resize: 'vertical' }}
                />
              </div>

              {/* Icon Selection & Options */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                {/* Icon Picker */}
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Icon Picker</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {['📢', '🔔', '⭐', '🔥', '🎉'].map((iconEmoji) => (
                      <button
                        key={iconEmoji}
                        type="button"
                        onClick={() => setAnnBar({ ...annBar, icon: iconEmoji, show_icon: true })}
                        style={{
                          fontSize: '1.1rem',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: (annBar.icon === iconEmoji && annBar.show_icon) ? '2px solid #d97706' : '1px solid rgba(255,255,255,0.15)',
                          backgroundColor: (annBar.icon === iconEmoji && annBar.show_icon) ? 'rgba(217,119,6,0.2)' : '#12151e',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {iconEmoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Show Icon Toggle */}
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Show Icon</label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '6px' }}>
                    <input
                      type="checkbox"
                      checked={annBar.show_icon !== undefined ? annBar.show_icon : true}
                      onChange={(e) => setAnnBar({ ...annBar, show_icon: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#38bdf8', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>Display Icon Before Text</span>
                  </label>
                </div>

                {/* Pause On Hover */}
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Pause On Hover</label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '6px' }}>
                    <input
                      type="checkbox"
                      checked={annBar.pause_on_hover !== undefined ? annBar.pause_on_hover : true}
                      onChange={(e) => setAnnBar({ ...annBar, pause_on_hover: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#38bdf8', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>Pause Scroll on Mouse Hover</span>
                  </label>
                </div>
              </div>

              {/* Speed & Typography Controls */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                {/* Scrolling Speed */}
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Scrolling Speed</label>
                  <select
                    value={annBar.speed || 'normal'}
                    onChange={(e) => setAnnBar({ ...annBar, speed: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none' }}
                  >
                    <option value="very_slow">Very Slow (32s)</option>
                    <option value="slow">Slow (22s)</option>
                    <option value="normal">Normal (15s)</option>
                    <option value="fast">Fast (10s)</option>
                    <option value="very_fast">Very Fast (6s)</option>
                  </select>
                </div>

                {/* Font Size */}
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Font Size</label>
                  <select
                    value={annBar.font_size || '14px'}
                    onChange={(e) => setAnnBar({ ...annBar, font_size: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none' }}
                  >
                    <option value="12px">12px (Small)</option>
                    <option value="14px">14px (Standard)</option>
                    <option value="16px">16px (Medium)</option>
                    <option value="18px">18px (Large)</option>
                  </select>
                </div>

                {/* Font Weight */}
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Font Weight</label>
                  <select
                    value={annBar.font_weight || '600'}
                    onChange={(e) => setAnnBar({ ...annBar, font_weight: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none' }}
                  >
                    <option value="400">400 (Normal)</option>
                    <option value="600">600 (Semi-Bold)</option>
                    <option value="700">700 (Bold)</option>
                  </select>
                </div>
              </div>

              {/* Color Pickers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Background Color Picker */}
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Background Color</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="color"
                      value={annBar.background_color || '#d97706'}
                      onChange={(e) => setAnnBar({ ...annBar, background_color: e.target.value })}
                      style={{ width: '40px', height: '38px', padding: '0', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
                    />
                    <input
                      type="text"
                      value={annBar.background_color || '#d97706'}
                      onChange={(e) => setAnnBar({ ...annBar, background_color: e.target.value })}
                      style={{ flex: 1, padding: '8px', borderRadius: '6px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                {/* Text Color Picker */}
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Text Color</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="color"
                      value={annBar.text_color || '#ffffff'}
                      onChange={(e) => setAnnBar({ ...annBar, text_color: e.target.value })}
                      style={{ width: '40px', height: '38px', padding: '0', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
                    />
                    <input
                      type="text"
                      value={annBar.text_color || '#ffffff'}
                      onChange={(e) => setAnnBar({ ...annBar, text_color: e.target.value })}
                      style={{ flex: 1, padding: '8px', borderRadius: '6px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Optional Link URL */}
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Optional Link URL (e.g. https://example.com)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={annBar.link_url || ''}
                  onChange={(e) => setAnnBar({ ...annBar, link_url: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none' }}
                />
              </div>

              {/* Interactive Live Preview Box */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Interactive Ticker Preview:</label>
                <div style={{
                  backgroundColor: annBar.background_color || '#d97706',
                  color: annBar.text_color || '#ffffff',
                  fontSize: annBar.font_size || '14px',
                  fontWeight: annBar.font_weight || '600',
                  height: '38px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  position: 'relative'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '0 16px',
                    whiteSpace: 'nowrap'
                  }}>
                    {(annBar.show_icon !== false && annBar.icon) && (
                      <span>{annBar.icon}</span>
                    )}
                    <span>{annBar.announcement_text || annBar.message || 'Announcement Message Preview'}</span>
                    {annBar.link_url && <span>🔗</span>}
                  </div>
                </div>
              </div>

              {annBarSaveMsg && <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#10b981' }}>{annBarSaveMsg}</div>}

              <button
                type="submit"
                style={{
                  width: '260px', padding: '12px', borderRadius: '8px', border: 'none',
                  backgroundColor: '#d97706', color: '#fff', fontWeight: 700, cursor: 'pointer',
                  fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(217,119,6,0.3)'
                }}
              >
                Save & Update Ticker Live
              </button>
            </form>

            <form onSubmit={handlePublishAnnouncement} style={{ backgroundColor: '#1a1d2e', borderRadius: '14px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>Broadcast Update or Release Notice</h3>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Announcement Title</label>
                <input
                  type="text"
                  placeholder="e.g. New Reading Themes Available!"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Announcement Message</label>
                <textarea
                  rows={3}
                  placeholder="Describe your update..."
                  value={annMessage}
                  onChange={(e) => setAnnMessage(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#12151e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: '200px', padding: '10px', borderRadius: '8px', border: 'none',
                  backgroundColor: '#10b981', color: '#fff', fontWeight: 700, cursor: 'pointer'
                }}
              >
                Publish Notice
              </button>
            </form>

            <div style={{ backgroundColor: '#1a1d2e', borderRadius: '14px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: '1rem', color: '#f8fafc' }}>Broadcast History</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {announcements.map((a) => (
                  <div key={a.id} style={{ backgroundColor: '#12151e', borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '4px' }}>{a.title} (v{a.version})</div>
                    <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginBottom: '6px' }}>{a.message}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Published: {a.date}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
