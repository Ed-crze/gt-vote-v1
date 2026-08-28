'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { signOut } from '@/lib/auth-client'
import { useNavigate } from '@/lib/hooks'
import { useInactivityTimeout } from '@/lib/useInactivityTimeout'
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

export default function SessionGuard() {
  const pathname = usePathname()
  const { navigateTo } = useNavigate()
  const [role, setRole] = useState<Role>('unknown')
  const [signingOut, setSigningOut] = useState(false)
  const signingOutRef = useRef(false)

  // getSession() rather than getUser(): it reads the already-decoded JWT out of
  // the cookie store with no network round-trip, so it can't hang the way
  // getUser() has in Chrome (see the note in app/dashboard/page.tsx).
  useEffect(() => {
    const supabase = createClient()
    let alive = true

    supabase.auth.getSession()
      .then(({ data: { session } }) => { if (alive) setRole(roleFromSession(session)) })
      .catch(() => { if (alive) setRole('none') })

    // The root layout never unmounts, so without this the guard would stay
    // disabled for the whole session after a user signs in.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setRole(roleFromSession(session))
    })

    return () => { alive = false; subscription.unsubscribe() }
  }, [])

  const isAdmin = role === 'admin'
  const authenticated = role === 'admin' || role === 'student'
  // On a public route this is false, so the hook attaches no listeners and runs
  // no timers at all.
  const enabled = authenticated && !isPublicRoute(pathname) && !signingOut

  const endSession = useCallback(async (reason?: 'timeout') => {
    if (signingOutRef.current) return
    signingOutRef.current = true
    setSigningOut(true)
    try {
      await signOut()
    } catch {
      // Even if revocation fails we still leave the page — proxy.ts will bounce
      // any stale session back to /login on the next request.
    }
    navigateTo(reason === 'timeout' ? '/login?reason=timeout' : '/login')
  }, [navigateTo])

  const handleTimeout = useCallback(() => { void endSession('timeout') }, [endSession])

  // SessionGuard lives in the root layout and never unmounts, so the sign-out
  // state has to be cleared by hand once we've landed on /login — otherwise the
  // "Signing you out" overlay would sit on top of the login form forever.
  useEffect(() => {
    if (signingOut && isPublicRoute(pathname)) {
      signingOutRef.current = false
      setSigningOut(false)
    }
  }, [pathname, signingOut])

  const { secondsRemaining, warning, reset } = useInactivityTimeout({
    timeoutMs: isAdmin ? ADMIN_TIMEOUT_MS : STUDENT_TIMEOUT_MS,
    warningMs: isAdmin ? ADMIN_WARNING_MS : STUDENT_WARNING_MS,
    enabled,
    onTimeout: handleTimeout,
  })

  if (!enabled && !signingOut) return null

  return (
    <InactivityWarning
      open={warning || signingOut}
      secondsRemaining={secondsRemaining}
      warningSeconds={(isAdmin ? ADMIN_WARNING_MS : STUDENT_WARNING_MS) / 1000}
      signingOut={signingOut}
      onStay={reset}
      onSignOut={() => { void endSession() }}
    />
  )
}
