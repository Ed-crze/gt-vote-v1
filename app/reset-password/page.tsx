'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageBackground from '@/components/PageBackground'

function getPwStrength(pw: string) {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_COLOR = ['', '#EF4444', '#F59E0B', '#3B82F6', '#22C55E']

function EyeIcon({ closed }: { closed?: boolean }) {
  if (closed) return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showCfm, setShowCfm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [shake, setShake] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  const strength = getPwStrength(password)

  function triggerShake() {
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login?error=invalid-reset-link')
      } else {
        setSessionReady(true)
      }
    })
  }, [router])

  async function handleReset() {
    setError('')
    if (!password) {
      setError('Please enter a new password.'); triggerShake(); return
    }
    if (strength < 2) {
      setError('Password is too weak. Add uppercase letters, numbers or symbols.'); triggerShake(); return
    }
    if (password !== confirm) {
      setError('Passwords do not match.'); triggerShake(); return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError('Failed to update password. Your reset link may have expired.')
        triggerShake()
        setLoading(false)
        return
      }

      setSuccess(true)
      await supabase.auth.signOut({ scope: 'others' })
      setTimeout(() => router.push('/login'), 3500)

    } catch {
      setError('Something went wrong. Please try again.')
      triggerShake()
      setLoading(false)
    }
  }

  // Loading state
  if (!sessionReady) {
    return (
      <PageBackground fadingOut={false}>
        <div className="min-h-screen flex items-center justify-center">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <Image src="/gctu-crest.png" alt="GCTU" width={56} height={56} className="object-contain" loading="eager" priority />
            <span className="spin" style={{
              display: 'inline-block', width: '28px', height: '28px',
              border: '3px solid rgba(201,162,39,0.3)', borderTopColor: '#C9A227', borderRadius: '50%'
            }} />
          </div>
        </div>
      </PageBackground>
    )
  }

  // Success state
  if (success) {
    return (
      <PageBackground fadingOut={false}>
        <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-3 content-fade-in">
          <div className="bg-white overflow-hidden login-card">
            <div className="flex items-center gap-3 px-5 py-4 login-card-header">
              <Image src="/gctu-crest.png" alt="GCTU" width={54} height={54} className="object-contain flex-shrink-0" loading="eager" priority />
              <div>
                <div className="login-university-name">Ghana Communication<br />Technology University</div>
                <div className="login-university-tagline">Knowledge Comes from Learning</div>
              </div>
            </div>
            <div className="login-success">
              <div className="pop-in login-success-icon">✓</div>
              <div className="fade-up-1 login-success-title">Password Updated!</div>
              <div className="fade-up-2 login-success-faculty">Your password has been changed successfully.</div>
              <div className="fade-up-3 login-success-redirect">Redirecting to sign in…</div>
              <div className="fade-up-4 flex justify-center gap-1.5">
                {[1, 2, 3].map(i => <span key={i} className={`dot-pulse-${i} login-dot`} />)}
              </div>
            </div>
          </div>
        </div>
      </PageBackground>
    )
  }

  return (
    <PageBackground fadingOut={false}>
      <div className="min-h-screen flex flex-col items-center justify-center p-4 py-8 gap-3 content-fade-in">

        {/* Back button */}
        <div className="w-full flex justify-end" style={{ maxWidth: '380px' }}>
          <button onClick={() => router.push('/login')} className="back-btn">← Back</button>
        </div>

        {/* Card — matches register/login card style */}
        <div className={`bg-white overflow-hidden register-card ${shake ? 'shake' : ''}`}>

          {/* Header — same as login/register */}
          <div className="register-header">
            <Image src="/gctu-crest.png" alt="GCTU" width={54} height={54} className="object-contain flex-shrink-0" loading="eager" priority />
            <div>
              <div className="register-uni-name">Ghana Communication<br />Technology University</div>
              <div className="register-uni-tagline">Knowledge Comes from Learning</div>
            </div>
          </div>

          <div className="register-body">

            {/* Key icon */}
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: 'rgba(27,42,94,0.08)',
              border: '1px solid rgba(27,42,94,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '14px', fontSize: '20px',
            }}>🔑</div>

            <h1 className="register-title">
              Reset your <span className="register-title-accent">Password</span>
            </h1>
            <p className="register-subtitle">
              Choose a strong new password for your GT-Vote account.
            </p>

            {/* Error */}
            {error && (
              <div className="register-error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" className="flex-shrink-0" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* New password */}
            <div className="register-form-group">
              <label className="register-label">New Password</label>
              <div className="login-pw-wrap">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleReset()}
                  placeholder="Enter new password"
                  className="form-input pw-input"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPw(v => !v)} className="pw-toggle">
                  <EyeIcon closed={showPw} />
                </button>
              </div>
              {/* Strength bar */}
              {password && (
                <div className="register-pw-strength">
                  <div className="register-pw-bar">
                    <div
                      className="register-pw-fill"
                      style={{ width: `${(strength / 4) * 100}%`, background: STRENGTH_COLOR[strength] }}
                    />
                  </div>
                  <span className="register-pw-label" style={{ color: STRENGTH_COLOR[strength] }}>
                    {STRENGTH_LABEL[strength]}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="register-form-group">
              <label className="register-label">Confirm Password</label>
              <div className="login-pw-wrap">
                <input
                  type={showCfm ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleReset()}
                  placeholder="Re-enter new password"
                  className="form-input pw-input"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowCfm(v => !v)} className="pw-toggle">
                  <EyeIcon closed={showCfm} />
                </button>
              </div>
              {/* Match indicator */}
              {confirm && (
                <div style={{
                  marginTop: '6px', fontSize: '0.75rem',
                  color: confirm === password ? '#22C55E' : '#EF4444',
                  fontWeight: 500,
                }}>
                  {confirm === password ? '✓ Passwords match' : '✗ Passwords do not match'}
                </div>
              )}
            </div>

            {/* Password requirements */}
            <div className="register-info-note" style={{ flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1B2A5E', marginBottom: '4px', letterSpacing: '0.04em' }}>
                PASSWORD REQUIREMENTS
              </div>
              {[
                { label: 'At least 8 characters', met: password.length >= 8 },
                { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
                { label: 'One number', met: /[0-9]/.test(password) },
                { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
              ].map(req => (
                <div key={req.label} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  fontSize: '0.78rem',
                  color: req.met ? '#22C55E' : '#6b7280',
                }}>
                  <span style={{ flexShrink: 0, fontSize: '0.7rem' }}>{req.met ? '✓' : '○'}</span>
                  {req.label}
                </div>
              ))}
            </div>

            {/* Submit button */}
            <button
              onClick={handleReset}
              disabled={loading}
              className="btn-signin"
              style={{ marginTop: '1rem' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="spin" style={{
                    display: 'inline-block', width: '15px', height: '15px',
                    border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%'
                  }} />
                  Updating password...
                </span>
              ) : 'SET NEW PASSWORD'}
            </button>

            {/* Security note */}
            <div className="security-badge" style={{ marginTop: '1rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span>After resetting, all other active sessions will be signed out automatically for your security.</span>
            </div>

            <p className="forgot-text" style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button
                onClick={() => router.push('/login')}
                className="forgot-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }}
              >
                ← Back to sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </PageBackground>
  )
}