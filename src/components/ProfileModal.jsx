import React, { useState } from 'react'
import { User, X, Check, Save } from 'lucide-react'

export default function ProfileModal({ userProfile, onSaveName, onClose }) {
  const [fullName, setFullName] = useState(userProfile?.full_name || '')
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrorMsg('')
    setSavedSuccess(false)

    try {
      const ok = await onSaveName(fullName.trim())
      if (ok) {
        setSavedSuccess(true)
        setTimeout(() => {
          onClose()
        }, 1200)
      } else {
        setErrorMsg('Failed to update profile. Please try again.')
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error updating profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        backgroundColor: '#1a1d2e',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '20px',
        padding: '28px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        position: 'relative'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            margin: '0 auto 12px',
            boxShadow: '0 6px 20px rgba(217, 119, 6, 0.3)'
          }}>
            <User size={26} />
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 4px 0', color: '#f8fafc' }}>
            Profile Settings
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
            {userProfile?.email || 'Logged in student'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Your Display Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Awais Alam"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                backgroundColor: '#12151e',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: '0.92rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {errorMsg && (
            <div style={{ fontSize: '0.8rem', color: '#ef4444' }}>
              {errorMsg}
            </div>
          )}

          {savedSuccess && (
            <div style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={16} />
              <span>Profile updated successfully!</span>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#d97706',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(217, 119, 6, 0.35)'
            }}
          >
            <Save size={16} />
            <span>{saving ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </form>
      </div>
    </div>
  )
}
