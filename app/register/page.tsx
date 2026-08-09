'use client'
import React, { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useNavigate } from '@/lib/hooks'
import { registerStudent } from '@/lib/auth-client'
import { createClient } from '@/lib/supabase/client'


function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

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

export default function RegisterPage() {
  const router = useRouter()
  const { navigateTo, fadingOut } = useNavigate()

  // Form state
  const [studentId, setStudentId]   = useState('')
  const [fullName, setFullName]     = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [showCfm, setShowCfm]       = useState(false)

  // UI state
  const [step, setStep]             = useState<'form' | 'otp' | 'success'>('form')
  const [error, setError]           = useState('')
  const [shake, setShake]           = useState(false)
  const [loading, setLoading]       = useState(false)

  // OTP state
  const [otp, setOtp]               = useState(['', '', '', '', '', ''])
  const [otpError, setOtpError]     = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [countdown, setCountdown]   = useState(30)
  const [canResend, setCanResend]   = useState(false)
  const [otpAnimating, setOtpAnimating] = useState<boolean[]>([false,false,false,false,false,false])

  const strength = getPwStrength(password)

  function triggerShake() {
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  function startCountdown() {
    setCountdown(30)
    setCanResend(false)
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(t); setCanResend(true); return 0 }
        return c - 1
      })
    }, 1000)
    setTimeout(() => {
      const first = document.getElementById('otp-0')
      if (first) (first as HTMLInputElement).focus()
    }, 100)
  }

 async function handleSubmit() {
  setError('')
  if (!studentId || !fullName || !email || !password || !confirm) {
    setError('Please fill in all fields.'); triggerShake(); return
  }
  if (!email.endsWith('@live.gctu.edu.gh')) {
    setError('Please use your GCTU email (e.g. 4211xxxxxx@live.gctu.edu.gh)'); triggerShake(); return
  }
  if (password !== confirm) {
    setError('Passwords do not match.'); triggerShake(); return
  }
  if (strength < 2) {
    setError('Password is too weak. Please choose a stronger password.'); triggerShake(); return
  }

  setLoading(true)
  try {
    await registerStudent({
      studentId,
      password,
      fullName,
      faculty: 'Faculty of Information Technology', // update when you add faculty field
      level: '',
    })
    setEmail(studentId.toLowerCase().trim() + '@live.gctu.edu.gh')
    // Supabase sends the OTP email — move to OTP step
    setStep('otp')
    startCountdown()
  } catch (err: any) {
  console.error('Registration error full details:', err)
  console.error('Error message:', err.message)
  console.error('Error code:', err.code)
  if (err.message?.includes('already registered') || err.message?.includes('duplicate')) {
    setError('An account with this email or Student ID already exists.')
  } else {
    setError(err.message || 'Registration failed. Please try again.')
  }
  triggerShake()
} finally {
  setLoading(false)
}
 }


  function handleOtpInput(idx: number, val: string) {
    const digits = val.replace(/[^0-9]/g, '')

    // Handle paste of full code
    if (digits.length > 1) {
      const newOtp = ['', '', '', '', '', '']
      digits.split('').slice(0, 6).forEach((ch, i) => { newOtp[i] = ch })
      setOtp(newOtp)
      setOtpError(false)
      const lastIdx = Math.min(digits.length - 1, 5)
      // Staggered pop animation for each pasted box
      newOtp.forEach((d, i) => {
        if (d) {
          setTimeout(() => {
            setOtpAnimating(prev => { const a = [...prev]; a[i] = true; return a })
            setTimeout(() => setOtpAnimating(prev => { const a = [...prev]; a[i] = false; return a }), 350)
          }, i * 80)
        }
      })
      setTimeout(() => {
        const el = document.getElementById('otp-' + lastIdx)
        if (el) (el as HTMLInputElement).focus()
      }, 10)
      if (newOtp.join('').length === 6) setTimeout(() => doVerify(newOtp), 150)
      return
    }

    const newOtp = [...otp]
    newOtp[idx] = digits.slice(-1)
    setOtp(newOtp)
    setOtpError(false)

    // Pop animation on this box
    if (digits) {
      setOtpAnimating(prev => { const a = [...prev]; a[idx] = true; return a })
      setTimeout(() => setOtpAnimating(prev => { const a = [...prev]; a[idx] = false; return a }), 350)
    }

    if (digits && idx < 5) {
      const next = document.getElementById('otp-' + (idx + 1))
      if (next) (next as HTMLInputElement).focus()
    }
    if (newOtp.join('').length === 6) setTimeout(() => doVerify(newOtp), 150)
  }

  function handleOtpKey(idx: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      const prev = document.getElementById('otp-' + (idx - 1))
      if (prev) (prev as HTMLInputElement).focus()
    }
    if (e.key === 'Enter') doVerify(otp)
  }

 async function doVerify(otpArr: string[]) {
  const code = otpArr.join('')
  if (code.length < 6) { setOtpError(true); triggerShake(); return }

  setOtpLoading(true)
  try {
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'signup',
    })

    if (error) {
      setOtpLoading(false)
      setOtpError(true)
      triggerShake()
      return
    }

    setStep('success')
    setTimeout(() => navigateTo('/login?id=' + studentId), 2500)
  } catch {
    setOtpLoading(false)
    setOtpError(true)
    triggerShake()
  }
}

async function handleResend() {
  setOtp(['', '', '', '', '', ''])
  setOtpError(false)

  const supabase = createClient()
  await supabase.auth.resend({ type: 'signup', email })

  startCountdown()
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
          <Image src="/gctu-crest.png" alt="GCTU" width={54} height={54} className="object-contain flex-shrink-0"  loading="eager" priority/>
          <div>
            <div className="register-uni-name">Ghana Communication<br />Technology University</div>
            <div className="register-uni-tagline">Knowledge Comes from Learning</div>
          </div>
        </div>

        {/* ── STEP 1: Registration Form ── */}
        {step === 'form' && (
          <div className="register-body">
            <h1 className="register-title">
              Create your <span className="register-title-accent">GT-Vote</span> Account
            </h1>
            <p className="register-subtitle">For L100, L200 and Graduate Students</p>

            {/* Info note */}
            <div className="register-info-note">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" style={{ marginTop: '1px' }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>
                Your name, faculty and programme will be fetched automatically from the GCTU system using your <strong>Student ID</strong>.
              </span>
            </div>

            {/* Error */}
            {error && (
              <div className="register-error">
                <WarningIcon />
                <span>{error}</span>
              </div>
            )}

            {/* Student ID */}
            <div className="register-form-group">
              <label className="register-label">Student ID</label>
              <input
                type="text"
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="Student ID e.g. 4211xxxxxx"
                className="form-input"
                tabIndex={1}
                autoComplete="username"
              />
            </div>

            {/* Full Name */}
            <div className="register-form-group">
              <label className="register-label">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="e.g. Kwame Asante"
                className="form-input"
                tabIndex={2}
              />
            </div>

            {/* GCTU Email */}
            <div className="register-form-group">
              <label className="register-label">GCTU Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="e.g. 4211xxxxxx@live.gctu.edu.gh"
                className="form-input"
                tabIndex={3}
                autoComplete="email"
              />
            </div>

            {/* Create Password */}
            <div className="register-form-group">
              <label className="register-label">Create Password</label>
              <div className="login-pw-wrap">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="Create a strong password"
                  className="form-input pw-input"
                  tabIndex={4}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="pw-toggle">
                  <EyeIcon />
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

            {/* Confirm Password */}
            <div className="register-form-group">
              <label className="register-label">Confirm Password</label>
              <div className="login-pw-wrap">
                <input
                  type={showCfm ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="Re-enter your password"
                  className="form-input pw-input"
                  tabIndex={5}
                />
                <button type="button" onClick={() => setShowCfm(!showCfm)} className="pw-toggle">
                  <EyeIcon />
                </button>
              </div>
            </div>

            {/* Submit */}
            <button onClick={handleSubmit} disabled={loading} className="btn-signin" style={{ marginTop: '0.75rem' }}>
              {loading
                ? <span className="flex items-center justify-center gap-2">
                    <span className="spin" style={{ display: 'inline-block', width: '15px', height: '15px', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%' }} />
                    Creating account...
                  </span>
                : 'CREATE ACCOUNT'
              }
            </button>

            <p className="forgot-text" style={{ marginTop: '1rem', textAlign: 'center' }}>
              Already have an account?{' '}
              <button
                onClick={() => navigateTo('/login')}
                className="forgot-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }}
              >
                Sign in here
              </button>
            </p>
          </div>
        )}

        {/* ── STEP 2: OTP Verification ── */}
        {step === 'otp' && (
          <div className="register-body" style={{ animation: 'fadeUp 0.3s ease' }}>
            <div className="register-otp-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>

            <h2 className="register-title">
              Verify your <span className="register-title-accent">Email</span>
            </h2>

            <p className="register-otp-sent">
              A 6-digit code has been sent to<br />
              <strong style={{ color: '#1B2A5E' }}>{email}</strong><br />
              Enter it below to complete your registration.
            </p>

            {otpError && (
              <div className="register-error">
                <WarningIcon />
                <span>
                  {otp.join('').length < 6
                    ? 'Please enter the full 6-digit code.'
                    : 'Incorrect code. Please check your email and try again.'}
                </span>
              </div>
            )}

            {/* OTP boxes */}
            <div className="register-otp-inputs">
              {otp.map((v, i) => (
                <input
                  key={i}
                  id={'otp-' + i}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={v}
                  onChange={e => handleOtpInput(i, e.target.value)}
                  onKeyDown={e => handleOtpKey(i, e)}
                  disabled={otpLoading}
                  className={`register-otp-box${v ? ' filled' : ''}${otpError ? ' otp-error' : ''}${otpAnimating[i] ? ' otp-pop' : ''}`}
                />
              ))}
            </div>

            {/* Resend */}
            <p className="register-resend">
              Didn&apos;t receive it?{' '}
              <button
                disabled={!canResend || otpLoading}
                onClick={handleResend}
                className="register-resend-btn"
              >
                {canResend
                  ? 'Resend OTP'
                  : <><span style={{ color: '#C9A227', fontWeight: 700 }}>{countdown}s</span> — Resend code</>
                }
              </button>
            </p>

            {/* Verify button */}
            <button onClick={() => doVerify(otp)} disabled={otpLoading} className="btn-signin">
              {otpLoading
                ? <span className="flex items-center justify-center gap-2">
                    <span className="spin" style={{ display: 'inline-block', width: '15px', height: '15px', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%' }} />
                    Verifying...
                  </span>
                : 'Verify & Create Account'
              }
            </button>

            <p className="forgot-text" style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button
                onClick={() => { setStep('form'); setOtp(['', '', '', '', '', '']); setOtpError(false) }}
                className="forgot-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }}
              >
                ← Change email address
              </button>
            </p>
          </div>
        )}

        {/* ── STEP 3: Success ── */}
        {step === 'success' && (
          <div className="login-success">
            <div className="pop-in login-success-icon">✓</div>
            <div className="fade-up-1 login-success-title">Account Created!</div>
            <div className="fade-up-2" style={{ fontSize: '0.8rem', color: '#7A7F9A', marginBottom: '4px' }}>
              Student ID:{' '}
              <strong style={{ fontFamily: 'monospace', color: '#1B2A5E', background: '#F0F4FF', padding: '2px 8px', borderRadius: '4px' }}>
                {studentId}
              </strong>
            </div>
            <div className="fade-up-3 login-success-redirect">
              Your GT-Vote account is ready.<br />Redirecting to sign in…
            </div>
            <div className="fade-up-4 flex justify-center gap-1.5" style={{ marginTop: '1rem' }}>
              {[1, 2, 3].map(i => <span key={i} className={`dot-pulse-${i} login-dot`} />)}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
