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
        router.replace('/login?error=invalid-reset-link')
      } else {
        setSessionReady(true)
      }
    })
  }, [router])

  async function handleReset() {
    setError('')
    if (!password) { setError('Please enter a new password.'); triggerShake(); return }
    if (strength < 2) { setError('Password is too weak. Add uppercase letters, numbers or symbols.'); triggerShake(); return }
    if (password !== confirm) { setError('Passwords do not match.'); triggerShake(); return }

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

  // ── LOADING ──
  if (!sessionReady) {
    return (
      <>
        <style>{CSS}</style>
        <div className="rp-page">
          <div className="rp-bg-grid" />
          <div className="rp-bg-glow" />
          <div className="rp-loading">
            <Image src="/gctu-crest.png" alt="GCTU" width={52} height={52} className="object-contain" loading="eager" priority />
            <div className="rp-brand">GT<span>-Vote</span></div>
            <div className="rp-spinner-lg" />
          </div>
        </div>
      </>
    )
  }

  // ── SUCCESS ──
  if (success) {
    return (
      <>
        <style>{CSS}</style>
        <div className="rp-page">
          <div className="rp-bg-grid" />
          <div className="rp-bg-glow" />
          <div className="rp-success-wrap">
            <div className="rp-success-icon pop-in">✓</div>
            <h2 className="rp-success-title">Password Updated!</h2>
            <p className="rp-success-sub">
              Your GT-Vote password has been changed successfully.<br/>
              Redirecting you to sign in…
            </p>
            <div className="rp-dots">
              {[1,2,3].map(i => <span key={i} className={`dot-pulse-${i} login-dot`} />)}
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── FORM ──
  return (
    <>
      <style>{CSS}</style>
      <div className="rp-page">
        <div className="rp-bg-grid" />
        <div className="rp-bg-glow" />

        <div className="rp-layout">
          {/* ── Left branding panel ── */}
          <div className="rp-left">
            <div className="rp-left-inner">
              <Image src="/gctu-crest.png" alt="GCTU" width={80} height={80} className="object-contain" loading="eager" priority />
              <div className="rp-left-brand">GT<span>-Vote</span></div>
              <div className="rp-left-sub">GCTU Student Union E-Voting System</div>

              <div className="rp-features">
                {[
                  { icon: '🔒', title: 'End-to-End Encrypted', desc: 'Your ballot is cryptographically anonymous' },
                  { icon: '🛡️', title: 'Zero Knowledge', desc: 'Not even admins can see who you voted for' },
                  { icon: '✅', title: 'Verifiable Receipt', desc: 'Confirm your vote was counted anytime' },
                ].map(f => (
                  <div key={f.title} className="rp-feature">
                    <span className="rp-feature-icon">{f.icon}</span>
                    <div>
                      <div className="rp-feature-title">{f.title}</div>
                      <div className="rp-feature-desc">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right form panel ── */}
          <div className="rp-right">
            {/* Mobile logo */}
            <div className="rp-mobile-logo">
              <Image src="/gctu-crest.png" alt="GCTU" width={48} height={48} className="object-contain" loading="eager" />
              <div>
                <div className="rp-mobile-brand">GT<span>-Vote</span></div>
                <div className="rp-mobile-sub">GCTU Student Union E-Voting System</div>
              </div>
            </div>

            <div className={`rp-form-card ${shake ? 'shake' : ''}`}>
              {/* Key icon */}
              <div className="rp-form-icon">🔑</div>

              <h1 className="rp-form-title">Reset your password</h1>
              <p className="rp-form-sub">
                Enter a strong new password for your GT-Vote account — at least 8 characters with uppercase, numbers, and symbols.
              </p>

              {error && (
                <div className="rp-error">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* New password */}
              <div className="rp-field">
                <label className="rp-label">New Password</label>
                <div className="rp-input-wrap">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleReset()}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    className="rp-input"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="rp-eye">
                    <EyeIcon closed={showPw} />
                  </button>
                </div>

                {password && (
                  <div className="rp-strength">
                    <div className="rp-strength-bar">
                      <div className="rp-strength-fill" style={{ width: `${(strength / 4) * 100}%`, background: STRENGTH_COLOR[strength] }} />
                    </div>
                    <div className="rp-strength-labels">
                      <span style={{ color: STRENGTH_COLOR[strength], fontWeight: 700 }}>{STRENGTH_LABEL[strength]}</span>
                      <span>{strength < 4 ? 'Add more complexity' : 'Strong password ✓'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div className="rp-field">
                <label className="rp-label">Confirm Password</label>
                <div className="rp-input-wrap">
                  <input
                    type={showCfm ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); setError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleReset()}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                    className={`rp-input ${confirm ? (confirm === password ? 'rp-input-ok' : 'rp-input-err') : ''}`}
                  />
                  <button type="button" onClick={() => setShowCfm(v => !v)} className="rp-eye">
                    <EyeIcon closed={showCfm} />
                  </button>
                </div>
                {confirm && (
                  <div className="rp-match" style={{ color: confirm === password ? '#22C55E' : '#EF4444' }}>
                    {confirm === password ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </div>
                )}
              </div>

              {/* Requirements */}
              <div className="rp-reqs">
                <div className="rp-reqs-title">PASSWORD REQUIREMENTS</div>
                {[
                  { label: 'At least 8 characters', met: password.length >= 8 },
                  { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
                  { label: 'One number', met: /[0-9]/.test(password) },
                  { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
                ].map(r => (
                  <div key={r.label} className="rp-req" style={{ color: r.met ? '#22C55E' : 'rgba(255,255,255,0.3)' }}>
                    <span>{r.met ? '✓' : '○'}</span>
                    {r.label}
                  </div>
                ))}
              </div>

              {/* Submit */}
              <button onClick={handleReset} disabled={loading} className="rp-submit">
                {loading ? (
                  <span className="rp-btn-inner">
                    <span className="rp-spinner" />
                    Updating password...
                  </span>
                ) : 'SET NEW PASSWORD'}
              </button>

              <div style={{ textAlign: 'center' }}>
                <button onClick={() => router.push('/login')} className="rp-back-link">
                  ← Back to sign in
                </button>
              </div>

              {/* Security note */}
              <div className="rp-security-note">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C9A227" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>After resetting, all other active sessions will be signed out automatically for your security.</span>
              </div>
            </div>

            <div className="rp-footer">© 2025 GT-Vote · Ghana Communication Technology University</div>
          </div>
        </div>
      </div>
    </>
  )
}

const CSS = `
  .rp-page {
    min-height: 100vh;
    background: #0A1628;
    display: flex;
    position: relative;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  .rp-bg-grid {
    position: fixed;
    inset: 0;
    background-image:
      linear-gradient(rgba(201,162,39,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(201,162,39,0.04) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
    z-index: 0;
  }

  .rp-bg-glow {
    position: fixed;
    top: -15%;
    left: 30%;
    transform: translateX(-50%);
    width: 500px;
    height: 350px;
    background: radial-gradient(ellipse, rgba(27,42,94,0.5) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  /* Loading */
  .rp-loading {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 100vh;
    width: 100%;
  }
  .rp-brand { font-size: 1.4rem; font-weight: 800; color: #fff; }
  .rp-brand span, .rp-left-brand span, .rp-mobile-brand span { color: #C9A227; }
  .rp-spinner-lg {
    width: 28px; height: 28px;
    border: 3px solid rgba(201,162,39,0.2);
    border-top-color: #C9A227;
    border-radius: 50%;
    animation: rp-spin 0.7s linear infinite;
  }
  @keyframes rp-spin { to { transform: rotate(360deg); } }

  /* Success */
  .rp-success-wrap {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    min-height: 100vh;
    width: 100%;
    text-align: center;
    padding: 2rem;
  }
  .rp-success-icon {
    width: 72px; height: 72px;
    border-radius: 50%;
    background: rgba(34,197,94,0.12);
    border: 2px solid #22C55E;
    display: flex; align-items: center; justify-content: center;
    font-size: 32px; color: #22C55E;
    margin-bottom: 4px;
  }
  .rp-success-title { font-size: 1.6rem; font-weight: 800; color: #fff; margin: 0; }
  .rp-success-sub { font-size: 0.88rem; color: rgba(255,255,255,0.5); margin: 0; line-height: 1.7; }
  .rp-dots { display: flex; gap: 6px; margin-top: 8px; }

  /* Layout */
  .rp-layout {
    display: flex;
    width: 100%;
    min-height: 100vh;
    position: relative;
    z-index: 1;
  }

  /* Left panel */
  .rp-left {
    display: none;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    border-right: 1px solid rgba(255,255,255,0.06);
    background: rgba(0,0,0,0.12);
  }
  .rp-left-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    max-width: 300px;
    text-align: center;
  }
  .rp-left-brand {
    font-size: 1.8rem;
    font-weight: 800;
    color: #fff;
    margin-top: 16px;
    letter-spacing: -0.5px;
  }
  .rp-left-sub {
    font-size: 0.8rem;
    color: rgba(255,255,255,0.4);
    margin-top: 6px;
    margin-bottom: 2.5rem;
  }
  .rp-features {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
  }
  .rp-feature {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 14px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    text-align: left;
  }
  .rp-feature-icon { font-size: 20px; flex-shrink: 0; margin-top: 1px; }
  .rp-feature-title { font-size: 0.83rem; font-weight: 600; color: #fff; }
  .rp-feature-desc { font-size: 0.73rem; color: rgba(255,255,255,0.4); margin-top: 2px; }

  /* Right panel */
  .rp-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1.5rem;
    min-height: 100vh;
    overflow-y: auto;
  }

  /* Mobile logo */
  .rp-mobile-logo {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 1.75rem;
  }
  .rp-mobile-brand { font-size: 1.3rem; font-weight: 800; color: #fff; }
  .rp-mobile-sub { font-size: 0.72rem; color: rgba(255,255,255,0.4); }

  /* Form card */
  .rp-form-card {
    width: 100%;
    max-width: 420px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    padding: 2rem 1.75rem;
    backdrop-filter: blur(12px);
  }

  .rp-form-icon {
    font-size: 24px;
    width: 52px; height: 52px;
    background: rgba(201,162,39,0.1);
    border: 1px solid rgba(201,162,39,0.25);
    border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 1.25rem;
  }

  .rp-form-title {
    font-size: 1.5rem;
    font-weight: 800;
    color: #fff;
    margin: 0 0 8px;
    letter-spacing: -0.4px;
  }
  .rp-form-sub {
    font-size: 0.83rem;
    color: rgba(255,255,255,0.4);
    margin: 0 0 1.5rem;
    line-height: 1.65;
  }

  .rp-error {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.25);
    border-radius: 10px;
    padding: 11px 13px;
    margin-bottom: 1.25rem;
    font-size: 0.82rem;
    color: #FCA5A5;
  }

  .rp-field { margin-bottom: 1.1rem; }
  .rp-label {
    display: block;
    font-size: 0.73rem;
    font-weight: 700;
    color: rgba(255,255,255,0.55);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 7px;
  }

  .rp-input-wrap { position: relative; }
  .rp-input {
    width: 100%;
    padding: 12px 44px 12px 14px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    color: #fff;
    font-size: 0.88rem;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.2s, background 0.2s;
    font-family: inherit;
  }
  .rp-input::placeholder { color: rgba(255,255,255,0.2); }
  .rp-input:focus { border-color: #C9A227; background: rgba(201,162,39,0.04); }
  .rp-input-ok { border-color: rgba(34,197,94,0.4) !important; }
  .rp-input-err { border-color: rgba(239,68,68,0.4) !important; }

  .rp-eye {
    position: absolute;
    right: 12px; top: 50%;
    transform: translateY(-50%);
    background: none; border: none; cursor: pointer;
    color: rgba(255,255,255,0.35);
    padding: 0;
    display: flex; align-items: center;
    transition: color 0.2s;
  }
  .rp-eye:hover { color: rgba(255,255,255,0.7); }

  .rp-strength { margin-top: 9px; }
  .rp-strength-bar {
    height: 4px;
    background: rgba(255,255,255,0.08);
    border-radius: 4px;
    overflow: hidden;
  }
  .rp-strength-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease, background 0.3s ease;
  }
  .rp-strength-labels {
    display: flex;
    justify-content: space-between;
    margin-top: 5px;
    font-size: 0.72rem;
    color: rgba(255,255,255,0.3);
  }

  .rp-match {
    margin-top: 6px;
    font-size: 0.73rem;
    font-weight: 600;
  }

  .rp-reqs {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 1.25rem;
  }
  .rp-reqs-title {
    font-size: 0.68rem;
    font-weight: 700;
    color: rgba(255,255,255,0.3);
    letter-spacing: 0.06em;
    margin-bottom: 8px;
  }
  .rp-req {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.76rem;
    margin-bottom: 4px;
    transition: color 0.2s;
  }

  .rp-submit {
    width: 100%;
    padding: 14px;
    background: #C9A227;
    border: none;
    border-radius: 10px;
    color: #0A1628;
    font-size: 0.88rem;
    font-weight: 800;
    cursor: pointer;
    letter-spacing: 0.05em;
    transition: background 0.2s, transform 0.1s;
    font-family: inherit;
    margin-bottom: 1rem;
  }
  .rp-submit:hover:not(:disabled) { background: #D4AD2D; }
  .rp-submit:active:not(:disabled) { transform: scale(0.99); }
  .rp-submit:disabled { opacity: 0.55; cursor: not-allowed; }

  .rp-btn-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .rp-spinner {
    display: inline-block;
    width: 15px; height: 15px;
    border: 2px solid rgba(10,22,40,0.3);
    border-top-color: #0A1628;
    border-radius: 50%;
    animation: rp-spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  .rp-back-link {
    background: none; border: none; cursor: pointer;
    color: rgba(255,255,255,0.35);
    font-size: 0.82rem;
    font-family: inherit;
    padding: 0;
    transition: color 0.2s;
    margin-bottom: 1.25rem;
    display: inline-block;
  }
  .rp-back-link:hover { color: #C9A227; }

  .rp-security-note {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(201,162,39,0.05);
    border: 1px solid rgba(201,162,39,0.12);
    border-radius: 8px;
    font-size: 0.72rem;
    color: rgba(255,255,255,0.3);
    line-height: 1.55;
    margin-top: 1rem;
  }

  .rp-footer {
    margin-top: 2rem;
    font-size: 0.72rem;
    color: rgba(255,255,255,0.18);
    text-align: center;
  }

  /* Responsive */
  @media (min-width: 768px) {
    .rp-left { display: flex; }
    .rp-mobile-logo { display: none; }
  }

  .shake { animation: shake 0.4s ease; }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-8px); }
    40% { transform: translateX(8px); }
    60% { transform: translateX(-5px); }
    80% { transform: translateX(5px); }
  }
  .pop-in { animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
  @keyframes popIn {
    from { transform: scale(0.5); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  input::placeholder { color: rgba(255,255,255,0.2); }
  input:focus { outline: none; }
`
