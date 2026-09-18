/**
 * Session inactivity timeout configuration — the single source of truth.
 *
 * These four values were previously hardcoded in components/SessionGuard.tsx.
 * They are collected here so a demonstration or test run never means editing
 * numbers in two places and hoping both get put back.
 *
 * The timeout is enforced entirely in the application layer (client side):
 * Supabase's native "Inactivity timeout" and "Time-box user sessions" are
 * Pro-plan features. See lib/useInactivityTimeout.ts for the mechanism and
 * proxy.ts for what the middleware does and does not check.
 *
 * PRECEDENCE, lowest to highest:
 *   1. PRODUCTION below — the committed defaults.
 *   2. NEXT_PUBLIC_* environment variables — per-environment overrides, in
 *      SECONDS, so a demo value can live in an uncommitted .env.local.
 *   3. DEMO_OVERRIDES below — the in-code escape hatch, off by default.
 */

export interface SessionTimeoutConfig {
  /** Total idle time before a voter is signed out. */
  studentTimeoutMs: number
  /** How much of the voter's window is left when the warning modal appears. */
  studentWarningMs: number
  /** Total idle time before an admin is signed out. */
  adminTimeoutMs: number
  /** How much of the admin's window is left when the warning modal appears. */
  adminWarningMs: number
}

// ────────────────────────────────────────────────────────────────────────────
// PRODUCTION VALUES — the numbers the system ships with.
// Do not edit these to run a demonstration; use DEMO_OVERRIDES below instead.
// ────────────────────────────────────────────────────────────────────────────
const PRODUCTION: SessionTimeoutConfig = {
  studentTimeoutMs: 30 * 60 * 1000, // 30 minutes
  studentWarningMs: 2 * 60 * 1000, //  2 minutes
  adminTimeoutMs: 15 * 60 * 1000, // 15 minutes
  adminWarningMs: 60 * 1000, //  1 minute
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║                                                                          ║
// ║   ⚠⚠⚠  TEMPORARY DEMONSTRATION VALUES ARE ACTIVE  ⚠⚠⚠                    ║
// ║                                                                          ║
// ║   These exist ONLY to capture the inactivity timeout on screen for test  ║
// ║   evidence. They are NOT production behaviour.                           ║
// ║                                                                          ║
// ║   TO RESTORE PRODUCTION TIMEOUTS: set DEMO_MODE to false (one word) —    ║
// ║   or delete this whole banner, DEMO_MODE and DEMO_OVERRIDES together.     ║
// ║                                                                          ║
// ║   Applied on 2026-09-18 for timeout test evidence.                        ║
// ║   Voter: 60s timeout / 20s warning.  Admin values deliberately untouched. ║
// ║                                                                          ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const DEMO_MODE = true

const DEMO_OVERRIDES: Partial<SessionTimeoutConfig> = {
  studentTimeoutMs: 60 * 1000, // DEMO 60s   (production: 30 * 60 * 1000)
  studentWarningMs: 20 * 1000, // DEMO 20s   (production:  2 * 60 * 1000)
  // adminTimeoutMs / adminWarningMs left alone — production values apply.
}

/**
 * Read an override given in SECONDS and return milliseconds.
 *
 * Anything unusable — unset, blank, non-numeric, zero, negative — falls back to
 * the committed default rather than throwing. A malformed env var must not be
 * able to produce a zero-length session timeout.
 *
 * Note the env names are written out in full at each call site: Next.js inlines
 * NEXT_PUBLIC_* vars only when referenced as a literal member expression, so
 * building the name dynamically would silently always read undefined.
 */
function msFromEnvSeconds(raw: string | undefined, fallbackMs: number): number {
  if (raw === undefined) return fallbackMs
  const seconds = Number(raw.trim())
  if (!Number.isFinite(seconds) || seconds <= 0) return fallbackMs
  return Math.round(seconds * 1000)
}

const fromEnv: SessionTimeoutConfig = {
  studentTimeoutMs: msFromEnvSeconds(
    process.env.NEXT_PUBLIC_SESSION_STUDENT_TIMEOUT_S,
    PRODUCTION.studentTimeoutMs
  ),
  studentWarningMs: msFromEnvSeconds(
    process.env.NEXT_PUBLIC_SESSION_STUDENT_WARNING_S,
    PRODUCTION.studentWarningMs
  ),
  adminTimeoutMs: msFromEnvSeconds(
    process.env.NEXT_PUBLIC_SESSION_ADMIN_TIMEOUT_S,
    PRODUCTION.adminTimeoutMs
  ),
  adminWarningMs: msFromEnvSeconds(
    process.env.NEXT_PUBLIC_SESSION_ADMIN_WARNING_S,
    PRODUCTION.adminWarningMs
  ),
}

const resolved: SessionTimeoutConfig = {
  ...fromEnv,
  ...(DEMO_MODE ? DEMO_OVERRIDES : {}),
}

/**
 * A warning window at least as long as the timeout would put the modal on
 * screen from the first tick with nothing to count down. Clamp rather than
 * throw: a misconfigured demo should degrade to "warn immediately", not break
 * the app for every signed-in user.
 */
function clampWarning(timeoutMs: number, warningMs: number): number {
  return Math.min(warningMs, timeoutMs)
}

export const STUDENT_TIMEOUT_MS = resolved.studentTimeoutMs
export const STUDENT_WARNING_MS = clampWarning(resolved.studentTimeoutMs, resolved.studentWarningMs)
export const ADMIN_TIMEOUT_MS = resolved.adminTimeoutMs
export const ADMIN_WARNING_MS = clampWarning(resolved.adminTimeoutMs, resolved.adminWarningMs)

/** True when anything is shortening the shipped values. Drives the dev warning. */
export const SESSION_TIMEOUTS_OVERRIDDEN =
  STUDENT_TIMEOUT_MS !== PRODUCTION.studentTimeoutMs ||
  STUDENT_WARNING_MS !== PRODUCTION.studentWarningMs ||
  ADMIN_TIMEOUT_MS !== PRODUCTION.adminTimeoutMs ||
  ADMIN_WARNING_MS !== PRODUCTION.adminWarningMs

// Loud console notice so a shortened timeout cannot be mistaken for a bug, and
// cannot quietly survive into a demo of something else.
if (SESSION_TIMEOUTS_OVERRIDDEN && typeof window !== 'undefined') {
  console.warn(
    '[GT-Vote] Session inactivity timeouts are OVERRIDDEN — not production values.\n' +
      `  voter: ${STUDENT_TIMEOUT_MS / 1000}s timeout / ${STUDENT_WARNING_MS / 1000}s warning ` +
      `(production ${PRODUCTION.studentTimeoutMs / 1000}s / ${PRODUCTION.studentWarningMs / 1000}s)\n` +
      `  admin: ${ADMIN_TIMEOUT_MS / 1000}s timeout / ${ADMIN_WARNING_MS / 1000}s warning ` +
      `(production ${PRODUCTION.adminTimeoutMs / 1000}s / ${PRODUCTION.adminWarningMs / 1000}s)\n` +
      '  Restore: set DEMO_MODE = false in lib/sessionTimeouts.ts and clear any ' +
      'NEXT_PUBLIC_SESSION_* vars in .env.local.'
  )
}
