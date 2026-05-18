'use client'
import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Lock, Shield, Eye, EyeOff } from 'lucide-react'
import { useNavigate } from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'

export default function AdminLoginPage() {
  const { navigateTo, fadingOut } = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [shake, setShake] = useState(false)
  const fieldRefs = useRef<(HTMLInputElement | null)[]>([])

  function triggerShake() {
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'Enter') handleLogin()
    if (e.key === 'Tab') {
      e.preventDefault()
      fieldRefs.current[(index + 1) % 3]?.focus()
    }
  }

 async function handleLogin() {
  if (!username || !password || !secretKey) {
    setError('All fields are required.')
    triggerShake()
    return
  }

  setError('')
  setLoading(true)

  try {
    // Step 1: Verify secret key server-side (never checked client-side)
    const keyCheck = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secretKey }),
    })

    if (!keyCheck.ok) {
      const data = await keyCheck.json()
      setLoading(false)
      setError(data.error || 'Invalid credentials. Please check all fields.')
      triggerShake()
      return
    }

    // Step 2: Authenticate with Supabase
    const supabase = createClient()
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: username,
      password,
    })

    if (loginError || !data.user) {
      setLoading(false)
      setError('Invalid credentials. Please check your username, password and secret key.')
      triggerShake()
      return
    }

    // Step 3: Verify admin role
    const role = data.user.app_metadata?.role
    if (role !== 'admin') {
      await supabase.auth.signOut()
      setLoading(false)
      setError('Access denied. This account does not have admin privileges.')
      triggerShake()
      return
    }

    setSuccess(true)
    sessionStorage.setItem('admin_auth', 'true')
    setTimeout(() => navigateTo('/admin/dashboard'), 800)

  } catch {
    console.error('Login error:',error)
    setLoading(false)
    setError('Something went wrong. Please try again.')
    triggerShake()
  }
}

  return (
    <div className={`admin-login-page${fadingOut ? ' fading-out' : ''}`}>
      <div className={`admin-login-card${shake ? ' shake' : ''}`}>

        {/* Top */}
        <div className="admin-login-top">
          <Image src="/gctu-crest.png" alt="GCTU" width={52} height={52} className="admin-login-crest"  loading="eager" priority/>
          <div className="admin-login-badge">
            <span className="admin-login-dot" />
            <Shield size={12} color="rgba(239,68,68,0.9)" />
            Admin Access
          </div>
          <div className="admin-login-title">Admin Panel</div>
          <div className="admin-login-sub">Ghana Communication Technology University</div>
        </div>

        {/* Error */}
        {error && (
          <div className="admin-login-error">{error}</div>
        )}

        {/* Fields */}
        <div className="admin-field">
          <label className="admin-field-label">Username</label>
          <input
            ref={el => { fieldRefs.current[0] = el }}
            className={`admin-field-input${error ? ' error' : ''}`}
            type="text"
            placeholder="Enter admin username"
            autoComplete="off"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => handleKeyDown(e, 0)}
          />
        </div>

        <div className="admin-field">
          <label className="admin-field-label">Password</label>
          <div className="admin-pw-wrap">
            <input
              ref={el => { fieldRefs.current[1] = el }}
              className={`admin-field-input${error ? ' error' : ''}`}
              type={showPw ? 'text' : 'password'}
              placeholder="Enter password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => handleKeyDown(e, 1)}
            />
            <button className="admin-pw-toggle" onClick={() => setShowPw(!showPw)}>
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div className="admin-field">
          <label className="admin-field-label">Secret Key</label>
          <div className="admin-pw-wrap">
            <input
              ref={el => { fieldRefs.current[2] = el }}
              className={`admin-field-input${error ? ' error' : ''}`}
              type={showKey ? 'text' : 'password'}
              placeholder="Electoral Commissioner key"
              value={secretKey}
              onChange={e => setSecretKey(e.target.value)}
              onKeyDown={e => handleKeyDown(e, 2)}
            />
            <button className="admin-pw-toggle" onClick={() => setShowKey(!showKey)}>
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <div className="admin-secret-note">Issued by the Electoral Commissioner only.</div>
        </div>

        {/* Login Button */}
        <button
          className={`admin-login-btn${success ? ' success' : ''}`}
          onClick={handleLogin}
          disabled={loading}
        >
          <Lock size={16} />
          {success ? 'Access Granted' : loading ? 'Verifying...' : 'Access Admin Panel'}
        </button>

        {/* Back link */}
        <div className="admin-back-link">
          <span onClick={() => navigateTo('/home')}>← Back to Student Portal</span>
        </div>

        {/* Security strip */}
        <div className="admin-security-strip">
          <Shield size={12} color="rgba(255,255,255,0.2)" />
          Restricted Area &nbsp;·&nbsp; Authorised Personnel Only
        </div>

      </div>
    </div>
  )
}
