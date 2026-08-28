'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

interface InactivityWarningProps {
  open: boolean
  secondsRemaining: number
  /** Total warning window, used to size the countdown bar. */
  warningSeconds: number
  signingOut?: boolean
  onStay: () => void
  onSignOut: () => void
}

function formatCountdown(seconds: number) {
  const safe = Math.max(0, seconds)
  if (safe < 60) return `${safe}s`
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export default function InactivityWarning({
  open,
  secondsRemaining,
  warningSeconds,
  signingOut = false,
  onStay,
  onSignOut,
}: InactivityWarningProps) {
  const pathname = usePathname()
  const stayRef = useRef<HTMLButtonElement>(null)
  const [stayHover, setStayHover] = useState(false)
  const [outHover, setOutHover] = useState(false)

  // Purely presentational: the ballot is the one page where signing out throws
  // away work in progress. A pathname check keeps this component free of any
  // coupling to the ballot page's state.
  const onBallot = pathname === '/ballot'

  useEffect(() => {
    if (!open || signingOut) return

    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Capture phase + stopPropagation: without this, Escape here would also
      // close the ballot review modal sitting underneath.
      e.preventDefault()
      e.stopPropagation()
      onStay()
    }

    document.addEventListener('keydown', handleKey, { capture: true })
    return () => document.removeEventListener('keydown', handleKey, { capture: true })
  }, [open, signingOut, onStay])

  useEffect(() => {
    if (open && !signingOut) stayRef.current?.focus()
  }, [open, signingOut])

  if (!open) return null

  const pct = warningSeconds > 0
    ? Math.max(0, Math.min(100, (secondsRemaining / warningSeconds) * 100))
    : 0
  const urgent = secondsRemaining <= 10

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inactivity-warning-title"
      style={{
        position: 'fixed',
        inset: 0,
        // Above every other layer in the app: .dash-notif-dd is 9999,
        // .dash-popup-overlay 9998, the ballot review modal 110.
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'dashFadeIn 0.25s ease',
      }}
    >
      <div
        style={{
          background: '#111827',
          border: '1px solid rgba(201,162,39,0.3)',
          borderRadius: '20px',
          padding: '2rem 1.5rem',
          width: '100%',
          maxWidth: '340px',
          textAlign: 'center',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          animation: 'dashPopIn 0.3s cubic-bezier(0.175,0.885,0.32,1.275)',
        }}
      >
        {signingOut ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <span
                className="spin"
                style={{
                  display: 'inline-block', width: '28px', height: '28px',
                  border: '3px solid rgba(201,162,39,0.25)', borderTopColor: '#C9A227',
                  borderRadius: '50%',
                }}
              />
            </div>
            <div id="inactivity-warning-title" style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fff', marginBottom: '0.5rem' }}>
              Signing you out
            </div>
            <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
              Taking you back to the sign-in page…
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }} aria-hidden="true">
              ⏳
            </div>

            <div id="inactivity-warning-title" style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fff', marginBottom: '0.5rem' }}>
              Still there?
            </div>

            <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: '1rem' }}>
              You&apos;ve been inactive for a while. For your security you&apos;ll be signed out in{' '}
              <strong style={{ color: '#C9A227' }}>{formatCountdown(secondsRemaining)}</strong>.
            </div>

            <div
              aria-live="assertive"
              aria-atomic="true"
              style={{
                fontSize: '2rem',
                fontWeight: 900,
                letterSpacing: '0.02em',
                color: urgent ? '#EF4444' : '#C9A227',
                marginBottom: '0.75rem',
                fontVariantNumeric: 'tabular-nums',
                transition: 'color 0.2s',
              }}
            >
              {formatCountdown(secondsRemaining)}
            </div>

            <div
              aria-hidden="true"
              style={{
                height: '4px',
                width: '100%',
                background: 'rgba(255,255,255,0.08)',
                borderRadius: '999px',
                overflow: 'hidden',
                marginBottom: onBallot ? '1rem' : '1.5rem',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: urgent ? '#EF4444' : '#C9A227',
                  borderRadius: '999px',
                  transition: 'width 1s linear, background 0.2s',
                }}
              />
            </div>

            {onBallot && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  textAlign: 'left',
                  padding: '10px 12px',
                  marginBottom: '1.5rem',
                  background: 'rgba(201,162,39,0.1)',
                  border: '1px solid rgba(201,162,39,0.35)',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  lineHeight: 1.5,
                  color: '#C9A227',
                  fontWeight: 600,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>You have unsaved ballot selections. Signing out will discard them.</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <button
                ref={stayRef}
                onClick={onStay}
                onMouseEnter={() => setStayHover(true)}
                onMouseLeave={() => setStayHover(false)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  width: '100%', padding: '13px',
                  background: stayHover ? '#253577' : '#1B2A5E',
                  color: '#fff',
                  border: '2px solid rgba(201,162,39,0.4)',
                  borderRadius: '10px',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '0.92rem', fontWeight: 800,
                  cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase',
                  transition: 'all 0.18s',
                }}
              >
                Stay Signed In
              </button>

              <button
                onClick={onSignOut}
                onMouseEnter={() => setOutHover(true)}
                onMouseLeave={() => setOutHover(false)}
                style={{
                  padding: '12px',
                  background: 'transparent',
                  color: outHover ? '#fff' : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${outHover ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)'}`,
                  borderRadius: '10px',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '0.88rem', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.18s',
                }}
              >
                Sign Out Now
              </button>
            </div>

            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', marginTop: '1rem' }}>
              Press <strong style={{ color: 'rgba(255,255,255,0.45)' }}>Esc</strong> to stay signed in
            </div>
          </>
        )}
      </div>
    </div>
  )
}
