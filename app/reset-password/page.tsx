'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
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

  // Verify session exists from the reset link
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // No session — reset link may be expired or already used
        router.replace('/login')
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
      setError('Password is too weak. Please choose a stronger password.'); triggerShake(); return
    }
    if (password !== confirm) {
      setError('Passwords do not match.'); triggerShake(); return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError('Failed to update password. Please try again.')
        triggerShake()
        setLoading(false)
        return
      }

      setSuccess(true)
      // Sign out all other sessions after password change
      await supabase.auth.signOut({ scope: 'others' })
      setTimeout(() => router.push('/login'), 3000)

    } catch {
      setError('Something went wrong. Please try again.')
      triggerShake()
      setLoading(false)
    }
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="spin" style={{
          display: 'inline-block', width: '24px', height: '24px',
          border: '3px solid rgba(0,0,0,0.1)', borderTopColor: '#1B2A5E', borderRadius: '50%'
        }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-3 content-fade-in">
      <div className={`bg-white overflow-hidden login-card ${shake ? 'shake' : ''}`}>

        {/* Header — same as login/register */}
        <div className="flex items-center gap-3 px-5 py-4 login-card-header">
          <Image src="/gctu-crest.png" alt="GCTU" width={54} height={54} className="object-contain flex-shrink-0"  loading="eager" priority/>
          <div>
            <div className="login-university-name">Ghana Communication<br />Technology University</div>
            <div className="login-university-tagline">Knowledge Comes from Learning</div>
          </div>
        </div>

        {!success ? (
          <div className="login-card-body">
            <h1 className="login-title">Reset your <span className="login-title-accent">Password</span></h1>
            <p className="login-subtitle">Choose a strong new password for your GT-Vote account.</p>

            {error && (
              <div className="login-error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" className="flex-shrink-0" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                {error}
              </div>
            )}

            <div className="login-form-group">
              <div className="login-pw-wrap">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleReset()}
                  placeholder="New password"
                  className="form-input pw-input"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="pw-toggle">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
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

            <div className="login-form-group">
              <input
                type="password"
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleReset()}
                placeholder="Confirm new password"
                className="form-input"
                autoComplete="new-password"
              />
            </div>

            <button
              onClick={handleReset}
              disabled={loading}
              className="btn-signin"
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
          </div>
        ) : (
          // Success screen — matches your existing login success style
          <div className="login-success">
            <div className="pop-in login-success-icon">✓</div>
            <div className="fade-up-1 login-success-title">Password Updated!</div>
            <div className="fade-up-2 login-success-faculty">Your password has been changed successfully.</div>
            <div className="fade-up-3 login-success-redirect">Redirecting to sign in…</div>
            <div className="fade-up-4 flex justify-center gap-1.5">
              {[1, 2, 3].map(i => <span key={i} className={`dot-pulse-${i} login-dot`} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}