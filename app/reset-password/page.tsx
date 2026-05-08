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

  // Loading spinner while checking session
  if (!sessionReady) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0D1B3E',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}>
          <Image src="/gctu-crest.png" alt="GCTU" width={56} height={56} className="object-contain" loading="eager" priority />
          <span className="spin" style={{
            display: 'inline-block', width: '28px', height: '28px',
            border: '3px solid rgba(201,162,39,0.3)', borderTopColor: '#C9A227', borderRadius: '50%'
          }} />
        </div>
      </div>
    )
  }

  // Success screen
  if (success) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0D1B3E',
        padding: '2rem',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          textAlign: 'center',
        }}>
          <div className="pop-in" style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: 'rgba(34,197,94,0.15)',
            border: '2px solid #22C55E',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '32px', color: '#22C55E',
          }}>✓</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>Password Updated!</div>
          <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', maxWidth: '280px', lineHeight: 1.6 }}>
            Your GT-Vote password has been changed successfully. You will be redirected to sign in shortly.
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            {[1, 2, 3].map(i => <span key={i} className={`dot-pulse-${i} login-dot`} />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: '#0D1B3E',
    }}>
      {/* ── Left Panel — branding ── */}
      <div style={{
        display: 'none',
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.15)',
      }} className="reset-left-panel">
        <Image src="/gctu-crest.png" alt="GCTU" width={96} height={96} className="object-contain" loading="eager" priority />
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
            GT<span style={{ color: '#C9A227' }}>-Vote</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginTop: '6px' }}>
            GCTU Student Union E-Voting System
          </div>
        </div>
        <div style={{ marginTop: '3rem', display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '300px' }}>
          {[
            { icon: '🔒', title: 'End-to-End Encrypted', desc: 'Your ballot is cryptographically anonymous' },
            { icon: '🛡️', title: 'Zero Knowledge', desc: 'Not even admins can see who you voted for' },
            { icon: '✅', title: 'Verifiable Receipt', desc: 'Confirm your vote was counted anytime' },
          ].map(item => (
            <div key={item.title} style={{
              display: 'flex', gap: '12px', alignItems: 'flex-start',
              padding: '14px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{item.title}</div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right Panel — form ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        minHeight: '100vh',
      }}>
        {/* Mobile logo — hidden on desktop */}
        <div className="reset-mobile-logo" style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <Image src="/gctu-crest.png" alt="GCTU" width={56} height={56} className="object-contain" loading="eager" priority />
          <div style={{ marginTop: '10px' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>
              GT<span style={{ color: '#C9A227' }}>-Vote</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>GCTU Student Union E-Voting System</div>
          </div>
        </div>

        {/* Form card */}
        <div className={shake ? 'shake' : ''} style={{
          width: '100%',
          maxWidth: '420px',
        }}>
          {/* Lock icon */}
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'rgba(201,162,39,0.12)',
            border: '1px solid rgba(201,162,39,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '20px',
            fontSize: '22px',
          }}>🔑</div>

          <h1 style={{
            fontSize: '1.6rem', fontWeight: 800, color: '#fff',
            margin: '0 0 6px',
            letterSpacing: '-0.5px',
          }}>Reset your password</h1>

          <p style={{
            fontSize: '0.88rem', color: 'rgba(255,255,255,0.5)',
            margin: '0 0 28px', lineHeight: 1.6,
          }}>
            Enter a new strong password for your GT-Vote account. Make sure it is at least 8 characters with uppercase, numbers, and symbols.
          </p>

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '20px',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" className="flex-shrink-0" style={{ marginTop: '1px' }} strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span style={{ fontSize: '0.85rem', color: '#FCA5A5' }}>{error}</span>
            </div>
          )}

          {/* New password field */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block', fontSize: '0.8rem', fontWeight: 600,
              color: 'rgba(255,255,255,0.7)', marginBottom: '8px',
              letterSpacing: '0.03em', textTransform: 'uppercase',
            }}>New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleReset()}
                placeholder="Enter new password"
                autoComplete="new-password"
                style={{
                  width: '100%',
                  padding: '13px 44px 13px 14px',
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#C9A227'}
                onBlur={e => e.target.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: '12px', top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.4)', padding: 0,
                  display: 'flex', alignItems: 'center',
                }}
              >
                <EyeIcon closed={showPw} />
              </button>
            </div>

            {/* Password strength bar */}
            {password && (
              <div style={{ marginTop: '10px' }}>
                <div style={{
                  height: '4px', borderRadius: '4px',
                  background: 'rgba(255,255,255,0.1)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${(strength / 4) * 100}%`,
                    background: STRENGTH_COLOR[strength],
                    borderRadius: '4px',
                    transition: 'width 0.3s ease, background 0.3s ease',
                  }} />
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  marginTop: '6px',
                }}>
                  <span style={{ fontSize: '0.75rem', color: STRENGTH_COLOR[strength], fontWeight: 600 }}>
                    {STRENGTH_LABEL[strength]}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>
                    {strength < 4 ? 'Add more complexity' : 'Strong password ✓'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm password field */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block', fontSize: '0.8rem', fontWeight: 600,
              color: 'rgba(255,255,255,0.7)', marginBottom: '8px',
              letterSpacing: '0.03em', textTransform: 'uppercase',
            }}>Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCfm ? 'text' : 'password'}
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleReset()}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                style={{
                  width: '100%',
                  padding: '13px 44px 13px 14px',
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${confirm && confirm !== password ? 'rgba(239,68,68,0.5)' : confirm && confirm === password ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#C9A227'}
                onBlur={e => {
                  if (confirm && confirm !== password) e.target.style.borderColor = 'rgba(239,68,68,0.5)'
                  else if (confirm && confirm === password) e.target.style.borderColor = 'rgba(34,197,94,0.5)'
                  else e.target.style.borderColor = 'rgba(255,255,255,0.12)'
                }}
              />
              <button
                type="button"
                onClick={() => setShowCfm(v => !v)}
                style={{
                  position: 'absolute', right: '12px', top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.4)', padding: 0,
                  display: 'flex', alignItems: 'center',
                }}
              >
                <EyeIcon closed={showCfm} />
              </button>
            </div>
            {/* Match indicator */}
            {confirm && (
              <div style={{ marginTop: '6px', fontSize: '0.75rem', color: confirm === password ? '#22C55E' : '#EF4444' }}>
                {confirm === password ? '✓ Passwords match' : '✗ Passwords do not match'}
              </div>
            )}
          </div>

          {/* Password requirements */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '24px',
          }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', fontWeight: 600 }}>
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
                fontSize: '0.78rem', marginBottom: '4px',
                color: req.met ? '#22C55E' : 'rgba(255,255,255,0.35)',
              }}>
                <span style={{ flexShrink: 0 }}>{req.met ? '✓' : '○'}</span>
                {req.label}
              </div>
            ))}
          </div>

          {/* Submit button */}
          <button
            onClick={handleReset}
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: loading ? 'rgba(201,162,39,0.5)' : '#C9A227',
              border: 'none',
              borderRadius: '10px',
              color: '#1B2A5E',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.05em',
              transition: 'background 0.2s, transform 0.1s',
              marginBottom: '16px',
            }}
            onMouseEnter={e => { if (!loading) (e.target as HTMLButtonElement).style.background = '#D4AD2D' }}
            onMouseLeave={e => { if (!loading) (e.target as HTMLButtonElement).style.background = '#C9A227' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span className="spin" style={{
                  display: 'inline-block', width: '15px', height: '15px',
                  border: '2px solid rgba(27,42,94,0.3)', borderTopColor: '#1B2A5E', borderRadius: '50%'
                }} />
                Updating password...
              </span>
            ) : 'SET NEW PASSWORD'}
          </button>

          {/* Back to login */}
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => router.push('/login')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem',
                padding: 0, fontFamily: 'inherit',
              }}
              onMouseEnter={e => (e.target as HTMLButtonElement).style.color = '#C9A227'}
              onMouseLeave={e => (e.target as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)'}
            >
              ← Back to sign in
            </button>
          </div>

          {/* Security note */}
          <div style={{
            marginTop: '32px',
            padding: '14px',
            background: 'rgba(201,162,39,0.06)',
            border: '1px solid rgba(201,162,39,0.15)',
            borderRadius: '10px',
            display: 'flex', gap: '10px', alignItems: 'flex-start',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9A227" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
              After resetting, all other active sessions will be signed out automatically for your security.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '2.5rem',
          fontSize: '0.75rem',
          color: 'rgba(255,255,255,0.2)',
          textAlign: 'center',
        }}>
          © 2025 GT-Vote · Ghana Communication Technology University
        </div>
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (min-width: 768px) {
          .reset-left-panel { display: flex !important; }
          .reset-mobile-logo { display: none !important; }
        }
        input::placeholder { color: rgba(255,255,255,0.25); }
        input:focus { outline: none; }
      `}</style>
    </div>
  )
}