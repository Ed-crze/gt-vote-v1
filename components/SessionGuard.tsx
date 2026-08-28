'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { signOut } from '@/lib/auth-client'
import { useNavigate } from '@/lib/hooks'
import {
  useInactivityTimeout,
  readSharedActivity,
  clearSessionActivity,
} from '@/lib/useInactivityTimeout'
import InactivityWarning from './InactivityWarning'

// Mirrors the route split in proxy.ts. Note /admin is the admin *login* page and
// is public, while everything under /admin/ is guarded — hence the exact match.
const PUBLIC_EXACT = ['/', '/admin']
const PUBLIC_PREFIXES = [
  '/home',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/manifestos',
  '/api',
]

function isPublicRoute(pathname: string) {
  if (PUBLIC_EXACT.includes(pathname)) return true
  return PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))
}

const STUDENT_TIMEOUT_MS = 30 * 60 * 1000
const STUDENT_WARNING_MS = 2 * 60 * 1000
const ADMIN_TIMEOUT_MS = 15 * 60 * 1000
const ADMIN_WARNING_MS = 60 * 1000

type Role = 'unknown' | 'none' | 'student' | 'admin'

function roleFromSession(session: Session | null): Role {
  if (!session) return 'none'
  return session.user.app_metadata?.role === 'admin' ? 'admin' : 'student'
}

/**
 * Sign-in time read straight off the JWT.
 *
 * This is the one freshness signal that cannot fail while the user is still
 * authenticated — it rides in the cookie store, so if it were unreadable there
 * would be no session to guard in the first place. That is what keeps the
 * fail-closed rule below from becoming a sign-out loop on browsers that block
 * site data, where the localStorage write at login and the read here fail
 * together.
 *
 * `last_sign_in_at` rather than the access token's `iat`: supabase-js refreshes
 * the token roughly hourly and would keep bumping `iat`, silently defeating the
 * whole check. `last_sign_in_at` only moves on an actual sign-in.
 */
function signInMs(session: Session | null): number | null {
  const raw = session?.user?.last_sign_in_at
  if (!raw) return null
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? ms : null
}

/**
 * The cross-browser-close check: has more than the role's timeout elapsed since
 * the last provable activity, whether or not a tab was open for any of it?
 */
function isSessionStale(session: Session | null, timeoutMs: number): boolean {
  const read = readSharedActivity()
  const stored = read.status === 'ok' ? read.timestamp : null
  const signedIn = signInMs(session)

  // Fail closed: with neither signal we cannot prove the session is fresh, and
  // for a voting system an inability to prove freshness has to mean re-auth.
  if (stored === null && signedIn === null) return true

  // max(), so the JWT acts as a floor: someone who just signed in is fresh even
  // when localStorage is unavailable.
  const last = Math.max(stored ?? 0, signedIn ?? 0)
  return Date.now() - last > timeoutMs
}

/** Minimal hold while the stale check resolves. */
function GuardPlaceholder() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center" aria-busy="true">
      <span
        className="spin"
        style={{
          display: 'inline-block', width: '24px', height: '24px',
          border: '3px solid rgba(255,255,255,0.15)',
          borderTopColor: '#C9A227', borderRadius: '50%',
        }}
      />
    </div>
  )
}

export default function SessionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { navigateTo } = useNavigate()
  // undefined = not resolved yet, distinct from null = resolved, no session.
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [staleChecked, setStaleChecked] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const signingOutRef = useRef(false)

  // getSession() rather than getUser(): it reads the already-decoded JWT out of
  // the cookie store with no network round-trip, so it can't hang the way
  // getUser() has in Chrome (see the note in app/dashboard/page.tsx).
  useEffect(() => {
    const supabase = createClient()
    let alive = true

    supabase.auth.getSession()
      .then(({ data: { session } }) => { if (alive) setSession(session) })
      .catch(() => { if (alive) setSession(null) })

    // The root layout never unmounts, so without this the guard would stay
    // disabled for the whole session after a user signs in.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (alive) setSession(next)
    })

    return () => { alive = false; subscription.unsubscribe() }
  }, [])

  const role: Role = session === undefined ? 'unknown' : roleFromSession(session)
  const isAdmin = role === 'admin'
  const authenticated = role === 'admin' || role === 'student'
  const onPublic = isPublicRoute(pathname)
  const timeoutMs = isAdmin ? ADMIN_TIMEOUT_MS : STUDENT_TIMEOUT_MS
  const warningMs = isAdmin ? ADMIN_WARNING_MS : STUDENT_WARNING_MS

  const endSession = useCallback(async (reason?: 'timeout', silent = false) => {
    if (signingOutRef.current) return
    signingOutRef.current = true
    // A session found stale on mount is ended silently: the user was not at the
    // keyboard for the countdown, so a modal would only delay the redirect.
    if (!silent) setSigningOut(true)
    clearSessionActivity()
    try {
      await signOut()
    } catch {
      // Even if revocation fails we still leave the page — proxy.ts will bounce
      // any stale session back to /login on the next request.
    }
    navigateTo(reason === 'timeout' ? '/login?reason=timeout' : '/login')
  }, [navigateTo])

  // The stale-session check. Runs before the timers, because the hook writes a
  // fresh timestamp the moment it is enabled (markActive on mount) and would
  // otherwise destroy the very evidence being checked.
  useEffect(() => {
    if (session === undefined || staleChecked) return
    if (onPublic || !authenticated) return
    if (isSessionStale(session, timeoutMs)) {
      void endSession('timeout', true)
      return
    }
    setStaleChecked(true)
  }, [session, staleChecked, onPublic, authenticated, timeoutMs, endSession])

  // Re-arm on every pass through a public route. The timer is disabled there,
  // so time spent on /home never refreshes the timestamp, and coming back to a
  // protected route has to be revalidated rather than trusted.
  useEffect(() => {
    if (onPublic && staleChecked) setStaleChecked(false)
  }, [onPublic, staleChecked])

  // On a public route this is false, so the hook attaches no listeners and runs
  // no timers at all.
  const enabled = authenticated && !onPublic && !signingOut && staleChecked

  const handleTimeout = useCallback(() => { void endSession('timeout') }, [endSession])

  // SessionGuard lives in the root layout and never unmounts, so the sign-out
  // state has to be cleared by hand once we've landed on /login — otherwise the
  // "Signing you out" overlay would sit on top of the login form forever.
  //
  // The re-entrancy ref is cleared on ANY arrival at a public route, not just
  // when `signingOut` is set: the silent stale-session path never sets it, so
  // gating the reset on it would leave the ref stuck true for the life of the
  // page and make every later sign-out a no-op.
  useEffect(() => {
    if (!isPublicRoute(pathname)) return
    signingOutRef.current = false
    if (signingOut) setSigningOut(false)
  }, [pathname, signingOut])

  const { secondsRemaining, warning, reset } = useInactivityTimeout({
    timeoutMs,
    warningMs,
    enabled,
    onTimeout: handleTimeout,
  })

  // Hold protected content back until the stale check has resolved, so an
  // expired session never renders authenticated UI.
  //
  // Accepted limitation: protected pages are server-rendered, so their HTML is
  // already in the RSC payload before any of this runs. This suppresses the
  // post-hydration render, not the first server paint. Closing that gap would
  // mean moving the check into proxy.ts, which working route protection depends
  // on — and the real security boundary is RLS at the database layer, so the
  // sub-second flash shows only content the user was authorised to see moments
  // earlier. Deliberately not chased.
  const gateContent =
    !onPublic && (session === undefined || (authenticated && !staleChecked))

  return (
    <>
      {gateContent ? <GuardPlaceholder /> : children}
      {(enabled || signingOut) && (
        <InactivityWarning
          open={warning || signingOut}
          secondsRemaining={secondsRemaining}
          warningSeconds={warningMs / 1000}
          signingOut={signingOut}
          onStay={reset}
          onSignOut={() => { void endSession() }}
        />
      )}
    </>
  )
}
