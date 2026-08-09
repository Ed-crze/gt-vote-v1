'use client'
import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useNavigate } from '@/lib/hooks'

function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { navigateTo, fadingOut } = useNavigate()

  const [studentId, setStudentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [showPopup, setShowPopup] = useState(false)

  function triggerShake() {
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  async function handleSubmit() {
    setError('')
    if (!studentId.trim()) {
      setError('Please enter your Student ID.')
      triggerShake()
      return
    }

    const idPart = studentId.toLowerCase().trim().split('@')[0]
    const constructedEmail = `${idPart}@live.gctu.edu.gh`

    setLoading(true)
    try {
      const supabase = createClient()
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
      await supabase.auth.resetPasswordForEmail(constructedEmail, {
        redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
      })
      // Always show success popup regardless — prevents email enumeration
      setShowPopup(true)
    } catch {
      setError('Something went wrong. Please try again.')
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 py-8 gap-3 ${fadingOut ? 'content-fade-out' : 'content-fade-in'}`}>

      {/* Back button */}
      <div className="w-full flex justify-end" style={{ maxWidth: '380px' }}>
        <button onClick={() => router.back()} className="back-btn">← Back</button>
      </div>

      {/* Card */}
      <div className={`bg-white overflow-hidden register-card ${shake ? 'shake' : ''}`}>

        {/* Header */}
        <div className="register-header">
          <Image src="/gctu-crest.png" alt="GCTU" width={54} height={54} className="object-contain flex-shrink-0" loading="eager" priority />
          <div>
            <div className="register-uni-name">Ghana Communication<br />Technology University</div>
            <div className="register-uni-tagline">Knowledge Comes from Learning</div>
          </div>
        </div>

        <div className="register-body"> 
          {/* Key icon */}
          <h1 className="register-title">
            Forgot your <span className="register-title-accent">Password?</span>
          </h1>
          <p className="register-subtitle">
            Enter your Student ID below. We will send a password reset link to your GCTU email address.
          </p>

          {error && (
            <div className="register-error">
              <WarningIcon />
              <span>{error}</span>
            </div>
          )}

          {/* Student ID field */}
          <div className="register-form-group">
            <label className="register-label">Student ID</label>
            <input
              type="text"
              value={studentId}
              onChange={e => { setStudentId(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="e.g. 4211xxxxxx"
              className="form-input"
              autoComplete="off"
              autoFocus
            />
            {studentId && (
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '6px' }}>
                Reset link will be sent to: <strong style={{ color: '#1B2A5E' }}>
                  {studentId.toLowerCase().trim().split('@')[0]}@live.gctu.edu.gh
                </strong>
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-signin"
            style={{ marginTop: '0.75rem' }}
          >
            {loading
              ? <span className="flex items-center justify-center gap-2">
                  <span className="spin" style={{ display: 'inline-block', width: '15px', height: '15px', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%' }} />
                  Sending reset link...
                </span>
              : 'SEND RESET LINK'
            }
          </button>

          <p className="forgot-text" style={{ marginTop: '1rem', textAlign: 'center' }}>
            Remembered your password?{' '}
            <button
              onClick={() => navigateTo('/login')}
              className="forgot-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }}
            >
              Sign in here
            </button>
          </p>
        </div>
      </div>

      {/* ── Success Popup Modal ── */}
      {showPopup && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '1.5rem',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={e => { if (e.target === e.currentTarget) { setShowPopup(false); navigateTo('/login') } }}
        >
          <div style={{
            background: '#fff',
            borderRadius: '20px',
            padding: '2rem 1.75rem',
            maxWidth: '340px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            animation: 'slideUp 0.3s ease',
          }}>
            {/* Email icon */}
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'rgba(27,42,94,0.08)',
              border: '2px solid rgba(27,42,94,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem',
              fontSize: '32px',
            }} className="pop-in">
              📧
            </div>

            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1B2A5E', marginBottom: '8px' }}>
              Check Your Email
            </div>

            <div style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.6, marginBottom: '6px' }}>
              A password reset link has been sent to
            </div>

            <div style={{
              fontSize: '0.85rem', fontWeight: 700,
              color: '#1B2A5E', fontFamily: 'monospace',
              background: '#F0F4FF', borderRadius: '8px',
              padding: '8px 12px', marginBottom: '16px',
              wordBreak: 'break-all',
            }}>
              {studentId.toLowerCase().trim().split('@')[0]}@live.gctu.edu.gh
            </div>

            <div style={{
              fontSize: '0.78rem', color: '#9ca3af',
              lineHeight: 1.6, marginBottom: '1.5rem',
              background: '#F9FAFB', borderRadius: '8px',
              padding: '10px 12px',
            }}>
              Click the link in the email to reset your password. The link expires in <strong>1 hour</strong>. Check your spam folder if you don't see it.
            </div>

            {/* Gold divider */}
            <div style={{ height: '2px', background: 'linear-gradient(to right, #C9A227, #E8C547, #C9A227)', borderRadius: '2px', marginBottom: '1.25rem' }} />

            <button onClick={() => { setShowPopup(false); navigateTo('/login') }} className="btn-signin" style={{ width: '100%' }} >
              Back to Sign In
            </button>

            <button
              onClick={() => setShowPopup(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#9ca3af', fontSize: '0.8rem', marginTop: '12px',
                fontFamily: 'inherit', padding: 0,
              }}
            >
              Send again
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  )
}