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
  const [sent, setSent] = useState(false)

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
      const { error } = await supabase.auth.resetPasswordForEmail(
        constructedEmail,
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        }
      )

      if (error) {
        setError('Failed to send reset email. Please try again.')
        triggerShake()
        setLoading(false)
        return
      }

      setSent(true)
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
          {!sent ? (
            <>
              <h1 className="register-title">
                Reset your <span className="register-title-accent">Password</span>
              </h1>
              <p className="register-subtitle">
                Enter your Student ID and we will send a reset link to your GCTU email.
              </p>

              {error && (
                <div className="register-error">
                  <WarningIcon />
                  <span>{error}</span>
                </div>
              )}

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
            </>
          ) : (
            /* Success state */
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'rgba(34,197,94,0.1)',
                border: '2px solid #22C55E',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.25rem',
                fontSize: '28px', color: '#22C55E',
              }} className="pop-in">✓</div>

              <h2 className="register-title">Check your <span className="register-title-accent">Email</span></h2>

              <p className="register-subtitle" style={{ marginBottom: '0.5rem' }}>
                A password reset link has been sent to
              </p>
              <p style={{ fontWeight: 700, color: '#1B2A5E', fontSize: '0.9rem', marginBottom: '1.5rem', fontFamily: 'monospace' }}>
                {studentId.toLowerCase().trim().split('@')[0]}@live.gctu.edu.gh
              </p>

              <div className="register-info-note" style={{ marginBottom: '1.5rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" style={{ marginTop: '1px' }}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>Click the link in the email to set a new password. The link expires in 1 hour.</span>
              </div>

              <button
                onClick={() => navigateTo('/login')}
                className="btn-signin"
              >
                Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}