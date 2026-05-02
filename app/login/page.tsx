'use client'
import { Suspense } from 'react'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { loginStudent } from '@/lib/auth-client'
import { createClient } from '@/lib/supabase/client'
import { useNavigate } from '@/lib/hooks'

function EyeIcon({ closed }: { closed?: boolean }) {
  if (closed) return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function LoginPageContent() {
 const router = useRouter()
  const searchParams = useSearchParams()
  const { navigateTo, fadingOut } = useNavigate()
 // const [studentId, setStudentId] = useState('')
   const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{ name: string; faculty: string } | null>(null)
  const [shake, setShake] = useState(false)
  const [step, setStep] = useState<'form' | 'otp' | 'success'>('form')
const [otp, setOtp] = useState(['', '', '', '', '', ''])
const [otpError, setOtpError] = useState(false)
const [otpLoading, setOtpLoading] = useState(false)
const [countdown, setCountdown] = useState(0)
const [canResend, setCanResend] = useState(false)
const [fullEmail, setFullEmail] = useState('')
const [pendingProfile, setPendingProfile] = useState<{ name: string; faculty: string } | null>(null)

 useEffect(() => {
  const id = searchParams.get('id')
  if (id) setEmail(id.toLowerCase().trim().split('@')[0])
}, [searchParams])
  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  function startCountdown() {
  setCountdown(60)
  setCanResend(false)
  const t = setInterval(() => {
    setCountdown(c => {
      if (c <= 1) { clearInterval(t); setCanResend(true); return 0 }
      return c - 1
    })
  }, 1000)
}

 const handleLogin = async () => {
  setError('')

  if (!email && !password) {
    setError('Please enter your Student ID and password.'); triggerShake(); return
  }
  if (!email) {
    setError('Please enter your Student ID.'); triggerShake(); return
  }
  if (!password) {
    setError('Please enter your password.'); triggerShake(); return
  }

  setLoading(true)
  try {
    const supabase = createClient()
   const idPart = email.toLowerCase().trim().split('@')[0]
   const constructedEmail = `${idPart}@live.gctu.edu.gh`

    // Step 1: Verify credentials
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: constructedEmail,
      password,
    })

    if (loginError) {
      setLoading(false)
      if (loginError.message?.includes('Email not confirmed')) {
        setError('Please verify your email first. Check your inbox.')
      } else {
        setError('Incorrect Student ID or password. Please try again.')
      }
      triggerShake()
      return
    }

    // Fetch profile to show on success screen later
    const { data: profile } = await supabase
      .from('students')
      .select('full_name, faculty')
      .eq('id', data.user.id)
      .single()

    setPendingProfile({
      name: profile?.full_name ?? 'Student',
      faculty: profile?.faculty ?? '',
    })

    // Sign out temporarily — OTP will re-authenticate
    await supabase.auth.signOut()

    // Step 2: Send OTP to their email
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: constructedEmail,
      options: { shouldCreateUser: false }
    })

    if (otpErr) {
      setLoading(false)
      setError('Failed to send verification code. Please try again.')
      triggerShake()
      return
    }

    setFullEmail(constructedEmail)
    setLoading(false)
    setStep('otp')
    startCountdown()

  }  catch (err: any) {
  setLoading(false)
  console.error('Login error:', err)
  console.error('Error message:', err?.message)
  setError(err?.message || 'Login failed. Please try again.')
  triggerShake()
}
}
 async function doVerify(otpArr: string[]) {
  const code = otpArr.join('')
  if (code.length < 6) { setOtpError(true); triggerShake(); return }

  setOtpLoading(true)
  try {
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      email: fullEmail,
      token: code,
      type: 'email',
    })

    if (error) {
      setOtpLoading(false)
      setOtpError(true)
      triggerShake()
      return
    }

    setSuccess(pendingProfile)
    setStep('success')
    setTimeout(() => navigateTo('/dashboard'), 2500)

  } catch {
    setOtpLoading(false)
    setOtpError(true)
    triggerShake()
  }
}

function handleOtpInput(idx: number, val: string) {
  const digits = val.replace(/[^0-9]/g, '')

  if (digits.length > 1) {
    const newOtp = ['', '', '', '', '', '']
    digits.split('').slice(0, 6).forEach((ch, i) => { newOtp[i] = ch })
    setOtp(newOtp)
    setOtpError(false)
    const lastIdx = Math.min(digits.length - 1, 5)
    setTimeout(() => {
      const el = document.getElementById(`login-otp-${lastIdx}`)
      if (el) (el as HTMLInputElement).focus()
    }, 10)
    if (newOtp.join('').length === 6) setTimeout(() => doVerify(newOtp), 150)
    return
  }

  const newOtp = [...otp]
  newOtp[idx] = digits.slice(-1)
  setOtp(newOtp)
  setOtpError(false)

  if (digits && idx < 5) {
    const next = document.getElementById(`login-otp-${idx + 1}`)
    if (next) (next as HTMLInputElement).focus()
  }
  if (newOtp.join('').length === 6) setTimeout(() => doVerify(newOtp), 150)
}

function handleOtpKey(idx: number, e: React.KeyboardEvent) {
  if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
    const prev = document.getElementById(`login-otp-${idx - 1}`)
    if (prev) (prev as HTMLInputElement).focus()
  }
  if (e.key === 'Enter') doVerify(otp)
}

async function handleResend() {
  setOtp(['', '', '', '', '', ''])
  setOtpError(false)
  const supabase = createClient()
  await supabase.auth.signInWithOtp({
    email: fullEmail,
    options: { shouldCreateUser: false }
  })
  startCountdown()
}

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 gap-3 ${fadingOut ? 'content-fade-out' : 'content-fade-in'}`}>
      {/* Back button */}
      <div className="w-full flex justify-end" style={{ maxWidth: '360px' }}>
        <button onClick={() => router.back()} className="back-btn">
          ← Back
        </button>
      </div>
      <div className={`bg-white overflow-hidden relative login-card ${shake ? 'shake' : ''}`}>
        <div className="flex items-center gap-3 px-5 py-4 login-card-header">
          <Image src="/gctu-crest.png" alt="GCTU" width={54} height={54} className="object-contain flex-shrink-0"  loading="eager" />
          <div>
            <div className="login-university-name">Ghana Communication<br />Technology University</div>
            <div className="login-university-tagline">Knowledge Comes from Learning</div>
          </div>
        </div>

        {step === 'form' && (
          <div className="login-card-body">
            <h1 className="login-title">Sign in to <span className="login-title-accent">GT-Vote</span></h1>
            <p className="login-subtitle">GCTU Student Union E-Voting System</p>

            <p className="login-notice">
            First-time Voter?Click Here to get started{' '}
              <button onClick={() => navigateTo('/register')} className="login-notice-link">click here</button>
            </p>

            {error && (
              <div className="login-error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" className="flex-shrink-0" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                {error}
              </div>
            )}
             
 <div className="login-form-group">
  <input
    type="text"
    value={email}
    onChange={e => {
      const val = e.target.value.split('@')[0]
      setEmail(val)
      setError('')
    }}
    onKeyDown={e => e.key === 'Enter' && handleLogin()}
    placeholder="Student ID e.g. 4211xxxxxx"
    className="form-input"
    autoComplete="off"
  />
</div>

            {/* PASSWORD FIELD — was missing */}
            <div className="login-form-group" style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Password"
                className="form-input"
                autoComplete="current-password"
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: '12px', top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', cursor: 'pointer', color: '#6b7280', padding: 0
                }}
                tabIndex={-1}
              >
                <EyeIcon closed={showPw} />
              </button>
            </div>
            <button onClick={handleLogin} disabled={loading} className="btn-signin">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="spin" style={{ display: 'inline-block', width: '15px', height: '15px', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%' }} />
                  Signing in...
                </span>
              ) : 'SIGN IN'}
            </button>

            <p className="forgot-text">
  Forgot your password?{' '}
  <a
    href="#"
    className="forgot-link"
    onClick={async (e) => {
      e.preventDefault()
      if (!email) {
        setError('Enter your email above first.')
        return
      }
      const supabase = createClient()
      await supabase.auth.resetPasswordForEmail(
        email.toLowerCase().trim(),
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        }
      )
      alert('Password reset email sent. Check your GCTU inbox.')
    }}
  >
    Click here to do a password reset
  </a>.
</p>
              

            <div className="security-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span>Your ballot is <strong>encrypted &amp; anonymous</strong> — your identity is never linked to your vote</span>
            </div>
          </div>
            )}

{step === 'otp' && (
  <div className="register-body" style={{ animation: 'fadeUp 0.3s ease' }}>
    <div className="register-otp-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    </div>
    <h2 className="register-title">Verify your <span className="register-title-accent">Identity</span></h2>
    <p className="register-otp-sent">
      A 6-digit security code has been sent to<br />
      <strong style={{ color: '#1B2A5E' }}>{fullEmail}</strong><br />
      Enter it below to complete sign in.
    </p>
    {otpError && (
      <div className="register-error">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" className="flex-shrink-0" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span>{otp.join('').length < 6 ? 'Please enter the full 6-digit code.' : 'Incorrect code. Please check your email and try again.'}</span>
      </div>
    )}
    <div className="register-otp-inputs">
      {otp.map((v, i) => (
        <input
          key={i}
          id={`login-otp-${i}`}
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={v}
          onChange={e => handleOtpInput(i, e.target.value)}
          onKeyDown={e => handleOtpKey(i, e)}
          disabled={otpLoading}
          className={`register-otp-box${v ? ' filled' : ''}${otpError ? ' otp-error' : ''}`}
        />
      ))}
    </div>
    <p className="register-resend">
      Didn&apos;t receive it?{' '}
      <button disabled={!canResend || otpLoading} onClick={handleResend} className="register-resend-btn">
        {canResend ? 'Resend Code' : <><span style={{ color: '#C9A227', fontWeight: 700 }}>{countdown}s</span> — Resend code</>}
      </button>
    </p>
    <button onClick={() => doVerify(otp)} disabled={otpLoading} className="btn-signin">
      {otpLoading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="spin" style={{ display: 'inline-block', width: '15px', height: '15px', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%' }} />
          Verifying...
        </span>
      ) : 'Verify & Sign In'}
    </button>
    <p className="forgot-text" style={{ marginTop: '1rem', textAlign: 'center' }}>
      <button onClick={() => { setStep('form'); setOtp(['', '', '', '', '', '']); setOtpError(false) }}
        className="forgot-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }}>
        ← Back to sign in
      </button>
    </p>
  </div>
)}

{step === 'success' && success && (
  <div className="login-success">
            <div className="pop-in login-success-icon">✓</div>
            <div className="fade-up-1 login-success-title">Verified!</div>
            <div className="fade-up-2 login-success-name">Welcome, {success.name}</div>
            <div className="fade-up-2 login-success-faculty">{success.faculty}</div>
            <div className="fade-up-3 login-success-redirect">Redirecting to your ballot…</div>
            <div className="fade-up-4 flex justify-center gap-1.5">
              {[1,2,3].map(i => <span key={i} className={`dot-pulse-${i} login-dot`} />)}
            </div>
        </div>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <span className="spin" style={{
          display: 'inline-block', width: '24px', height: '24px',
          border: '3px solid rgba(0,0,0,0.1)', borderTopColor: '#1B2A5E', borderRadius: '50%'
        }} />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  )
}
