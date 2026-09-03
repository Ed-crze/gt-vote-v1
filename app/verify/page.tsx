'use client'
import { useState, useEffect, useRef } from 'react'
import { Search, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useNavigate } from '@/lib/hooks'

export default function VerifyPage() {
  const { navigateTo, fadingOut } = useNavigate()
  const [resultPositions, setResultPositions] = useState(0)
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'found' | 'notfound'>('idle')
  const [resultTime, setResultTime] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-fill from whatever this device kept when the ballot was cast.
  // There is no server-side fallback — receipts are deliberately
  // unrecoverable once submitted, so this is the only source.
  useEffect(() => {
    let stored = ''
    try { stored = localStorage.getItem('gt_receipt') || '' } catch {}
    if (!stored) {
      try { stored = sessionStorage.getItem('gt_receipt') || '' } catch {}
    }
    if (stored) setCode(formatCode(stored))
  }, [])


  function formatCode(raw: string) {
    const clean = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12)
    let out = ''
    for (let i = 0; i < clean.length; i++) {
      if (i > 0 && i % 4 === 0) out += '-'
      out += clean[i]
    }
    return out
  }

  function handleInput(val: string) {
    setCode(formatCode(val))
    setStatus('idle')
  }

 async function verify() {
  const clean = code.replace(/-/g, '')
  if (clean.length < 12) return

  const supabase = createClient()

  // Try the code as displayed, then the un-hyphenated form — the stored
  // format is a database-side detail and either may be what it holds.
  let { data, error } = await supabase.rpc('verify_receipt', {
    p_receipt_code: code,
  })

  if (!error && (!data || data.length === 0 || !data[0].is_valid)) {
    ;({ data, error } = await supabase.rpc('verify_receipt', {
      p_receipt_code: clean,
    }))
  }

  if (error || !data || data.length === 0 || !data[0].is_valid) {
    setStatus('notfound')
    return
  }

  // verify_receipt returns (is_valid, positions_recorded, recorded_at).
  const result = data[0]

  setResultTime(
    result.recorded_at
      ? new Date(result.recorded_at).toLocaleString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        })
      : '—'
  )
  setResultPositions(Number(result.positions_recorded ?? 0))
  setStatus('found')
}

  const isReady = code.replace(/-/g, '').length >= 12

  return (
    <div className={`verify-page${fadingOut ? ' fading-out' : ''}`}>

      {/* Top Nav */}
      <nav className="verify-nav">
        <div className="verify-nav-left">
          <img src="/gctu-crest.png" alt="GCTU" className="verify-nav-crest"  loading="eager"  />
          <div className="verify-nav-title">GT<span>-Vote</span></div>
        </div>
        <button className="verify-nav-back" onClick={() => navigateTo('/dashboard')}>
          ← Dashboard
        </button>
      </nav>

      {/* Content */}
      <div className="verify-content fade-up-1">

        {/* Icon + Title */}
        <div className="verify-page-icon">
          <Search size={28} color="#C9A227" strokeWidth={2} />
        </div>
        <div className="verify-page-title">Verify Your Vote</div>
        <div className="verify-page-sub">
          Enter your ballot receipt code to confirm<br />
          your vote was recorded in the system.
        </div>

        {/* Input Card */}
        <div className="verify-card">
          <div className="verify-input-label">Receipt Code</div>
          <input
            ref={inputRef}
            className={`verify-code-input${status === 'notfound' ? ' error' : ''}${status === 'found' ? ' success' : ''}`}
            type="text"
            placeholder="XXXX-XXXX-XXXX"
            maxLength={14}
            autoComplete="off"
            spellCheck={false}
            value={code}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') verify() }}
          />
          <button
            className="verify-btn"
            onClick={verify}
            disabled={!isReady}
          >
            <Search size={16} strokeWidth={2} className="verify-icon-inline" />
            &nbsp; Verify Now
          </button>
          <div className="verify-hint">
            Your code was shown after you cast your ballot.<br />
            Format: XXXX-XXXX-XXXX
          </div>
        </div>

        {/* Result Box */}
        {status !== 'idle' && (
          <div className={`verify-result-box${status === 'found' ? ' found' : ' notfound'}`}>
            <div className="verify-result-icon">
              {status === 'found'
                ? <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                : <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              }
            </div>
            <div className="verify-result-title">
              {status === 'found' ? 'Vote Verified!' : 'Code Not Found'}
            </div>
            <div className="verify-result-msg">
              {status === 'found'
                ? 'Your ballot was successfully recorded in the system. Your identity remains completely anonymous.'
                : 'This receipt code does not match any ballot in our records. Please check the code and try again.'
              }
            </div>
            {status === 'found' && (
              <div className="verify-result-detail">
                <div className="verify-result-row">
                  <div className="verify-result-row-label">Receipt Code</div>
                  <div className="verify-result-row-val">{code}</div>
                </div>
                <div className="verify-result-row">
                  <div className="verify-result-row-label">Recorded At</div>
                  <div className="verify-result-row-val">{resultTime}</div>
                </div>
                {resultPositions > 0 && (
                  <div className="verify-result-row">
                    <div className="verify-result-row-label">Positions Recorded</div>
                    <div className="verify-result-row-val">
                      {resultPositions} {resultPositions === 1 ? 'position' : 'positions'}
                    </div>
                  </div>
                )}
                <div className="verify-result-row">
                  <div className="verify-result-row-label">Ballot Status</div>
                  <div className="verify-result-row-val verify-counted">Counted</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Security Note */}
        <div className="verify-security-note fade-up-2">
          <div className="verify-security-title">
            <Lock size={14} strokeWidth={2} className="verify-icon-inline" />
            How Verification Works
          </div>
          <div className="verify-security-text">
            Your receipt code is a cryptographic token tied to your ballot — not your identity.
            Entering it here confirms your vote exists in the system without revealing who you voted for.
            Your anonymity is fully preserved at all times.
          </div>
        </div>

      </div>
    </div>
  )
}
