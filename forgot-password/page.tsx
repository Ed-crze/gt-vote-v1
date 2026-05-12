'use client'
import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useNavigate } from '@/lib/hooks'

function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { navigateTo, fadingOut } = useNavigate()

  const [email, setEmail] = useState('')
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
    if (!email.trim()) {
      setError('Please enter your email address.')
      triggerShake()
      return
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address.')
      triggerShake()
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.toLowerCase().trim(),
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        }
      )

      if (resetError) {
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

  // ── SUCCESS STATE ──
  if (sent) {
    return (
      <>
        <style>{CSS}</style>
        <div className={`fp-page ${fadingOut ? 'content-fade-out' : 'content-fade-in'}`}>
          <div className="fp-bg-grid" />
          <div className="fp-bg-glow" />
          <div className="fp-success-wrap">
            <div className="fp-success-logo">
              <Image src="/gctu-crest.png" alt="GCTU" width={44} height={44} className="object-contain" loading="eager" />
              <span className="fp-brand">GT<span>-Vote</span></span>
            </div>
            <div className="fp-success-card">
              <div className="fp-success-icon-wrap">
                <div className="fp-success-ring fp-ring-1" />
                <div className="fp-success-ring fp-ring-2" />
                <div className="fp-success-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9A227" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
              </div>
              <h1 className="fp-success-title">Check your inbox</h1>
              <p className="fp-success-sub">We sent a password reset link to</p>
              <div className="fp-success-email">{email.toLowerCase().trim()}</div>
              <div className="fp-success-steps">
                {[
                  { n: '1', text: 'Open your email inbox' },
                  { n: '2', text: 'Click the reset link in the email' },
                  { n: '3', text: 'Set your new password' },
                ].map(s => (
                  <div key={s.n} className="fp-step">
                    <div className="fp-step-n">{s.n}</div>
                    <div className="fp-step-text">{s.text}</div>
                  </div>
                ))}
              </div>
              <div className="fp-success-note">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C9A227" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                The link expires in 1 hour. Check your spam folder if you don&apos;t see it.
              </div>
              <button className="fp-back-btn" onClick={() => navigateTo('/login')}>← Back to Sign In</button>
              <button className="fp-resend-btn" onClick={() => { setSent(false); setEmail('') }}>Try a different email</button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── FORM STATE ──
  return (
    <>
      <style>{CSS}</style>
      <div className={`fp-page ${fadingOut ? 'content-fade-out' : 'content-fade-in'}`}>
        <div className="fp-bg-grid" />
        <div className="fp-bg-glow" />

        <button className="fp-nav-back" onClick={() => router.back()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>

        <div className="fp-center">
          <div className="fp-header">
            <Image src="/gctu-crest.png" alt="GCTU" width={52} height={52} className="object-contain" loading="eager" />
            <div>
              <div className="fp-uni-name">Ghana Communication Technology University</div>
              <div className="fp-uni-tag">Knowledge Comes from Learning</div>
            </div>
          </div>

          <div className={`fp-card ${shake ? 'shake' : ''}`}>
            <div className="fp-card-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9A227" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>

            <h1 className="fp-title">Reset your <span>Password</span></h1>
            <p className="fp-subtitle">
              Enter the email address associated with your GT-Vote account and we&apos;ll send you a reset link.
            </p>

            {error && (
              <div className="fp-error">
                <WarningIcon />
                <span>{error}</span>
              </div>
            )}

            <div className="fp-field">
              <label className="fp-label">Email Address</label>
              <div className="fp-input-wrap">
                <svg className="fp-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="e.g. 4211xxxxxx@live.gctu.edu.gh"
                  className="fp-input"
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <button onClick={handleSubmit} disabled={loading} className="fp-submit-btn">
              {loading ? (
                <span className="fp-btn-inner">
                  <span className="fp-spinner" />
                  Sending reset link...
                </span>
              ) : (
                <span className="fp-btn-inner">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  Request Password Reset
                </span>
              )}
            </button>

            <div className="fp-divider" />

            <p className="fp-bottom-text">
              Remembered your password?{' '}
              <button onClick={() => navigateTo('/login')} className="fp-link">Sign in here</button>
            </p>

            <div className="fp-security">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C9A227" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span>Reset links are one-time use and expire after 1 hour</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

const CSS = `
  .fp-page {
    min-height: 100vh; background: #0A1628;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 2rem 1rem; position: relative; overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  .fp-bg-grid {
    position: fixed; inset: 0;
    background-image: linear-gradient(rgba(201,162,39,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(201,162,39,0.04) 1px, transparent 1px);
    background-size: 40px 40px; pointer-events: none; z-index: 0;
  }
  .fp-bg-glow {
    position: fixed; top: -20%; left: 50%; transform: translateX(-50%);
    width: 600px; height: 400px;
    background: radial-gradient(ellipse, rgba(27,42,94,0.6) 0%, transparent 70%);
    pointer-events: none; z-index: 0;
  }
  .fp-nav-back {
    position: fixed; top: 1.25rem; left: 1.25rem;
    display: flex; align-items: center; gap: 6px;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.6); font-size: 0.82rem; font-weight: 500;
    padding: 7px 14px; border-radius: 8px; cursor: pointer; transition: all 0.2s;
    z-index: 10; font-family: inherit;
  }
  .fp-nav-back:hover { background: rgba(255,255,255,0.1); color: #fff; }
  .fp-center { width: 100%; max-width: 400px; position: relative; z-index: 1; display: flex; flex-direction: column; gap: 1.25rem; }
  .fp-header { display: flex; align-items: center; gap: 12px; padding: 0 4px; }
  .fp-uni-name { font-size: 0.82rem; font-weight: 700; color: #fff; line-height: 1.3; }
  .fp-uni-tag { font-size: 0.72rem; color: #C9A227; font-style: italic; margin-top: 2px; }
  .fp-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 2rem 1.75rem; backdrop-filter: blur(12px); }
  .fp-card-icon { width: 48px; height: 48px; border-radius: 14px; background: rgba(201,162,39,0.1); border: 1px solid rgba(201,162,39,0.25); display: flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; }
  .fp-title { font-size: 1.55rem; font-weight: 800; color: #fff; margin: 0 0 8px; letter-spacing: -0.4px; }
  .fp-title span { color: #C9A227; }
  .fp-subtitle { font-size: 0.85rem; color: rgba(255,255,255,0.45); margin: 0 0 1.5rem; line-height: 1.6; }
  .fp-error { display: flex; align-items: flex-start; gap: 10px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); border-radius: 10px; padding: 11px 13px; margin-bottom: 1.25rem; font-size: 0.83rem; color: #FCA5A5; }
  .fp-field { margin-bottom: 1.25rem; }
  .fp-label { display: block; font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
  .fp-input-wrap { position: relative; }
  .fp-input-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.3); pointer-events: none; }
  .fp-input { width: 100%; padding: 13px 14px 13px 40px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; color: #fff; font-size: 0.9rem; outline: none; box-sizing: border-box; transition: border-color 0.2s, background 0.2s; font-family: inherit; }
  .fp-input::placeholder { color: rgba(255,255,255,0.2); }
  .fp-input:focus { border-color: #C9A227; background: rgba(201,162,39,0.05); }
  .fp-submit-btn { width: 100%; padding: 14px; background: #C9A227; border: none; border-radius: 10px; color: #0A1628; font-size: 0.9rem; font-weight: 700; cursor: pointer; letter-spacing: 0.03em; transition: background 0.2s, transform 0.1s; font-family: inherit; margin-bottom: 1.25rem; }
  .fp-submit-btn:hover:not(:disabled) { background: #D4AD2D; }
  .fp-submit-btn:active:not(:disabled) { transform: scale(0.99); }
  .fp-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .fp-btn-inner { display: flex; align-items: center; justify-content: center; gap: 8px; }
  .fp-spinner { display: inline-block; width: 15px; height: 15px; border: 2px solid rgba(10,22,40,0.3); border-top-color: #0A1628; border-radius: 50%; animation: fp-spin 0.7s linear infinite; flex-shrink: 0; }
  @keyframes fp-spin { to { transform: rotate(360deg); } }
  .fp-divider { height: 1px; background: rgba(255,255,255,0.07); margin-bottom: 1.25rem; }
  .fp-bottom-text { text-align: center; font-size: 0.83rem; color: rgba(255,255,255,0.35); margin: 0 0 1rem; }
  .fp-link { background: none; border: none; cursor: pointer; color: #C9A227; font-weight: 600; font-size: inherit; font-family: inherit; padding: 0; text-decoration: underline; text-underline-offset: 2px; }
  .fp-link:hover { color: #D4AD2D; }
  .fp-security { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; background: rgba(201,162,39,0.05); border: 1px solid rgba(201,162,39,0.12); border-radius: 8px; font-size: 0.73rem; color: rgba(255,255,255,0.35); line-height: 1.5; }

  /* SUCCESS */
  .fp-success-wrap { width: 100%; max-width: 420px; position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 1.5rem; }
  .fp-success-logo { display: flex; align-items: center; gap: 10px; }
  .fp-brand { font-size: 1.3rem; font-weight: 800; color: #fff; }
  .fp-brand span { color: #C9A227; }
  .fp-success-card { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 2.5rem 2rem; text-align: center; backdrop-filter: blur(12px); display: flex; flex-direction: column; align-items: center; }
  .fp-success-icon-wrap { position: relative; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; }
  .fp-success-ring { position: absolute; border-radius: 50%; border: 1px solid rgba(201,162,39,0.2); animation: fp-pulse 2s ease-in-out infinite; }
  .fp-ring-1 { width: 80px; height: 80px; animation-delay: 0s; }
  .fp-ring-2 { width: 58px; height: 58px; animation-delay: 0.4s; }
  @keyframes fp-pulse { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.9; transform: scale(1.06); } }
  .fp-success-icon { width: 46px; height: 46px; border-radius: 50%; background: rgba(201,162,39,0.12); border: 1px solid rgba(201,162,39,0.35); display: flex; align-items: center; justify-content: center; z-index: 1; }
  .fp-success-title { font-size: 1.5rem; font-weight: 800; color: #fff; margin: 0 0 8px; }
  .fp-success-sub { font-size: 0.85rem; color: rgba(255,255,255,0.45); margin: 0 0 10px; }
  .fp-success-email { font-size: 0.85rem; font-weight: 700; color: #C9A227; background: rgba(201,162,39,0.08); border: 1px solid rgba(201,162,39,0.2); border-radius: 8px; padding: 8px 16px; margin-bottom: 1.75rem; font-family: monospace; word-break: break-all; }
  .fp-success-steps { width: 100%; display: flex; flex-direction: column; gap: 10px; margin-bottom: 1.5rem; text-align: left; }
  .fp-step { display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; }
  .fp-step-n { width: 24px; height: 24px; border-radius: 50%; background: rgba(201,162,39,0.15); border: 1px solid rgba(201,162,39,0.3); color: #C9A227; font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .fp-step-text { font-size: 0.82rem; color: rgba(255,255,255,0.6); }
  .fp-success-note { display: flex; align-items: flex-start; gap: 8px; font-size: 0.75rem; color: rgba(255,255,255,0.3); background: rgba(201,162,39,0.04); border: 1px solid rgba(201,162,39,0.1); border-radius: 8px; padding: 10px 12px; margin-bottom: 1.75rem; text-align: left; line-height: 1.5; width: 100%; box-sizing: border-box; }
  .fp-back-btn { width: 100%; padding: 13px; background: #C9A227; border: none; border-radius: 10px; color: #0A1628; font-size: 0.88rem; font-weight: 700; cursor: pointer; font-family: inherit; margin-bottom: 10px; transition: background 0.2s; }
  .fp-back-btn:hover { background: #D4AD2D; }
  .fp-resend-btn { width: 100%; padding: 12px; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: rgba(255,255,255,0.4); font-size: 0.83rem; font-weight: 500; cursor: pointer; font-family: inherit; transition: all 0.2s; }
  .fp-resend-btn:hover { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.7); }

  .shake { animation: shake 0.4s ease; }
  @keyframes shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(5px); } }
  .content-fade-in { animation: fadeIn 0.3s ease; }
  .content-fade-out { animation: fadeOut 0.3s ease forwards; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
  input::placeholder { color: rgba(255,255,255,0.2); }
  input:focus { outline: none; }
`
