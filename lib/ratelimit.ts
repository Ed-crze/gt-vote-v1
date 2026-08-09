type Entry = { count: number; resetAt: number; locked: boolean }
const store = new Map<string, Entry>()

export function rateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
  lockoutSeconds = 0
): { allowed: boolean; remaining: number; resetIn: number; locked: boolean } {
  const now = Date.now()
  let entry = store.get(key)

  if (entry && now > entry.resetAt && !entry.locked) {
    store.delete(key)
    entry = undefined
  }

  if (!entry) {
    store.set(key, { count: 1, resetAt: now + windowSeconds * 1000, locked: false })
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowSeconds, locked: false }
  }

  if (entry.locked) {
    const resetIn = Math.ceil((entry.resetAt - now) / 1000)
    return { allowed: false, remaining: 0, resetIn: Math.max(0, resetIn), locked: true }
  }

  entry.count++

  if (entry.count > maxRequests) {
    if (lockoutSeconds > 0) {
      entry.locked = true
      entry.resetAt = now + lockoutSeconds * 1000
    }
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.ceil((entry.resetAt - now) / 1000),
      locked: entry.locked
    }
  }

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetIn: Math.ceil((entry.resetAt - now) / 1000),
    locked: false
  }
}

export const loginRateLimit = (ip: string) =>
  rateLimit(`login:${ip}`, 5, 300, 900)

export const registerRateLimit = (ip: string) =>
  rateLimit(`register:${ip}`, 3, 3600)

export const verifyRateLimit = (ip: string) =>
  rateLimit(`verify:${ip}`, 10, 600)