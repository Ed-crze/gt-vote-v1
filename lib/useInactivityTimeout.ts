'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Client-side inactivity timeout.
 *
 * Supabase's native "Inactivity timeout" / "Time-box user sessions" are Pro-plan
 * features, so the same behaviour lives here in the application layer.
 */

// Capture phase, so a scroll inside a nested container (the ballot's candidate
// list) or a click whose propagation a modal has stopped still counts as
// activity. scroll does not bubble, so listening on window without capture
// would miss every inner scroller.
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'] as const

// One timestamp shared by every tab of the app. Activity anywhere keeps every
// other tab alive, which is what stops an idle /dashboard tab from signing the
// user out mid-vote in another tab. A plain localStorage value is deliberate:
// BroadcastChannel would add a second cross-tab coordination channel, and
// lib/supabase/client.ts documents what the first one (navigator.locks) already
// cost this project.
const ACTIVITY_KEY = 'gtvote-last-activity'

// mousemove alone fires hundreds of times a second — write at most once per second.
const THROTTLE_MS = 1000
const TICK_MS = 1000

/**
 * Why these are distinct rather than one nullable number: `missing` and
 * `unparseable` mean storage works and we simply have no usable value, whereas
 * `unavailable` means we cannot read OR write and no timestamp we record will
 * ever survive. They currently lead to the same fail-closed outcome, but they
 * are very different failures to be looking at in a bug report.
 */
export type ActivityRead =
  | { status: 'ok'; timestamp: number }
  | { status: 'missing' }
  | { status: 'unparseable'; raw: string }
  | { status: 'unavailable'; error: unknown }

export function readSharedActivity(): ActivityRead {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(ACTIVITY_KEY)
  } catch (error) {
    // Safari private mode and blocked site data both throw here.
    return { status: 'unavailable', error }
  }
  if (raw === null) return { status: 'missing' }
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return { status: 'unparseable', raw }
  return { status: 'ok', timestamp: parsed }
}

/** Timestamp-or-null view, for the running timer's hot path. */
function readSharedActivityMs(): number | null {
  const read = readSharedActivity()
  return read.status === 'ok' ? read.timestamp : null
}

function writeSharedActivity(timestamp: number) {
  try {
    window.localStorage.setItem(ACTIVITY_KEY, String(timestamp))
  } catch {
    /* see readSharedActivity */
  }
}

/**
 * Record activity from outside the hook. Called at the moment a session is
 * established so a fresh login always has a timestamp before SessionGuard
 * evaluates one.
 */
export function markSessionActive(timestamp: number = Date.now()) {
  writeSharedActivity(timestamp)
}

/**
 * Drop the shared timestamp on explicit sign-out, so the next login starts
 * clean instead of inheriting whatever the previous user left behind.
 */
export function clearSessionActivity() {
  try {
    window.localStorage.removeItem(ACTIVITY_KEY)
  } catch {
    /* see readSharedActivity */
  }
}

export interface InactivityTimeoutOptions {
  /** Total idle time before the session is ended. */
  timeoutMs: number
  /** How much of that time is left when the warning fires. */
  warningMs: number
  /** When false, no listeners and no timers are attached at all. */
  enabled?: boolean
  onWarning?: () => void
  onTimeout?: () => void
}

export interface InactivityTimeoutState {
  /** Seconds until sign-out, for the countdown display. */
  secondsRemaining: number
  /** True once only `warningMs` remains. */
  warning: boolean
  /** Dismiss the warning and restart the full countdown. */
  reset: () => void
}

export function useInactivityTimeout({
  timeoutMs,
  warningMs,
  enabled = true,
  onWarning,
  onTimeout,
}: InactivityTimeoutOptions): InactivityTimeoutState {
  const [warning, setWarning] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(() => Math.ceil(timeoutMs / 1000))

  const lastActivityRef = useRef(0)
  const lastWriteRef = useRef(0)
  const warningRef = useRef(false)
  const timedOutRef = useRef(false)

  // Callbacks live in refs so a caller re-creating them never tears down and
  // re-attaches the listeners (which would restart the countdown).
  const onWarningRef = useRef(onWarning)
  const onTimeoutRef = useRef(onTimeout)
  useEffect(() => { onWarningRef.current = onWarning }, [onWarning])
  useEffect(() => { onTimeoutRef.current = onTimeout }, [onTimeout])

  const markActive = useCallback((timestamp: number) => {
    lastActivityRef.current = timestamp
    lastWriteRef.current = timestamp
    warningRef.current = false
    timedOutRef.current = false
    writeSharedActivity(timestamp)
    setWarning(false)
    setSecondsRemaining(Math.ceil(timeoutMs / 1000))
  }, [timeoutMs])

  const reset = useCallback(() => markActive(Date.now()), [markActive])

  useEffect(() => {
    if (!enabled) return

    // The countdown starts on mount.
    markActive(Date.now())

    const handleActivity = () => {
      // Once the warning is up, only an explicit "Stay Signed In" (or Escape)
      // clears it. Otherwise the mouse drifting across the screen would silently
      // dismiss a modal the user never saw a reason for.
      if (warningRef.current || timedOutRef.current) return
      const now = Date.now()
      if (now - lastWriteRef.current < THROTTLE_MS) return
      lastWriteRef.current = now
      lastActivityRef.current = now
      writeSharedActivity(now)
    }

    const tick = () => {
      if (timedOutRef.current) return

      // Wall-clock, not accumulated ticks: a throttled background tab or a
      // laptop that slept through the whole window still resolves correctly.
      const shared = readSharedActivityMs()
      const last = shared !== null ? Math.max(shared, lastActivityRef.current) : lastActivityRef.current
      lastActivityRef.current = last

      const remaining = timeoutMs - (Date.now() - last)

      if (remaining <= 0) {
        timedOutRef.current = true
        setSecondsRemaining(0)
        // Deliberately not forcing `warning` true here: if the machine slept
        // straight past the warning window, flashing the modal at 0s on wake
        // helps nobody. If it was already open it stays open through sign-out.
        onTimeoutRef.current?.()
        return
      }

      setSecondsRemaining(Math.ceil(remaining / 1000))

      if (remaining <= warningMs) {
        if (!warningRef.current) {
          warningRef.current = true
          setWarning(true)
          onWarningRef.current?.()
        }
      } else if (warningRef.current) {
        // Another tab reported activity — stand down.
        warningRef.current = false
        setWarning(false)
      }
    }

    const handleVisibility = () => {
      // Background tabs get their intervals throttled hard. Re-check the moment
      // the tab comes back rather than waiting out the next tick.
      if (!document.hidden) tick()
    }

    ACTIVITY_EVENTS.forEach(evt =>
      window.addEventListener(evt, handleActivity, { passive: true, capture: true })
    )
    document.addEventListener('visibilitychange', handleVisibility)
    const intervalId = window.setInterval(tick, TICK_MS)

    return () => {
      ACTIVITY_EVENTS.forEach(evt =>
        window.removeEventListener(evt, handleActivity, { capture: true })
      )
      document.removeEventListener('visibilitychange', handleVisibility)
      window.clearInterval(intervalId)
    }
  }, [enabled, timeoutMs, warningMs, markActive])

  return { secondsRemaining, warning, reset }
}
