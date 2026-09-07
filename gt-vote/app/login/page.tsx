'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { GTV } from '@/lib/store'
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

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { navigateTo, fadingOut } = useNavigate()
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{ name: string; faculty: string } | null>(null)
  const [shake, setShake] = useState(false)

  useEffect(() => {
    const id = searchParams.get('id')
    if (id) setStudentId(id)
  }, [searchParams])

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  const handleLogin = () => {
    setError('')
    if (!studentId && !password) { setError('Please enter your Student ID and password.'); triggerShake(); return }
    if (!studentId) { setError('Please enter your Student ID.'); triggerShake(); return }
    if (!password) { setError('Please enter your password.'); triggerShake(); return }

    setLoading(true)
    setTimeout(() => {
      const match = GTV.login(studentId, password)
      if (!match) {
        const allStudents = GTV.getStudents()
        const idExists = allStudents.find(s => s.id === studentId)
        setLoading(false)
        setError(idExists ? 'Incorrect password. Please try again.' : 'No account found for this Student ID. Please register first.')
        triggerShake()
      } else {
        setSuccess({ name: match.name, faculty: match.faculty })
        setTimeout(() => navigateTo('/dashboard'), 2500)
      }
    }, 1400)
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
          <Image src="/gctu-crest.png" alt="GCTU" width={54} height={54} className="object-contain flex-shrink-0" />
          <div>
            <div className="login-university-name">Ghana Communication<br />Technology University</div>
            <div className="login-university-tagline">Knowledge Comes from Learning</div>
          </div>
        </div>

        {!success ? (
          <div className="login-card-body">
            <h1 className="login-title">Sign in to <span className="login-title-accent">GT-Vote</span></h1>
            <p className="login-subtitle">GCTU Student Union E-Voting System</p>

            <p className="login-notice">
              If you are in L100, L200 and Graduate Students{' '}
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
              <input type="text" value={studentId} onChange={e => setStudentId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Student ID e.g. 4211xxxxxx" className="form-input" autoComplete="username" />
            </div>

            <div className="login-form-group login-pw-wrap">
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Password" className="form-input pw-input" autoComplete="current-password" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="pw-toggle">
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
              <a href="#" className="forgot-link">Click here to do a password reset.</a>
            </p>

            <div className="security-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span>Your ballot is <strong>encrypted &amp; anonymous</strong> — your identity is never linked to your vote</span>
            </div>
          </div>
        ) : (
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
