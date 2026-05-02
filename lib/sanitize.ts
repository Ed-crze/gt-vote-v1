export function sanitizeStudentId(input: string): string {
  if (!input || typeof input !== 'string') throw new Error('Student ID required')
  const clean = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20)
  if (clean.length < 4) throw new Error('Invalid Student ID')
  return clean
}

export function sanitizeName(input: string): string {
  if (!input || typeof input !== 'string') throw new Error('Name required')
  const clean = input.trim().replace(/[<>"'`;\\]/g, '').slice(0, 100)
  if (clean.length < 2) throw new Error('Name too short')
  return clean
}

export function sanitizePassword(input: string): string {
  if (!input || typeof input !== 'string') throw new Error('Password required')
  if (input.length < 8) throw new Error('Password must be at least 8 characters')
  if (input.length > 128) throw new Error('Password too long')
  return input
}

export function sanitizeText(input: string): string {
  if (!input || typeof input !== 'string') return ''
  return input.trim().replace(/[<>"'`;\\]/g, '').slice(0, 500)
}

export function sanitizeEmail(input: string): string {
  if (!input || typeof input !== 'string') throw new Error('Email required')
  const clean = input.trim().toLowerCase().replace(/[^a-z0-9@._\-]/g, '').slice(0, 100)
  if (!clean.includes('@')) throw new Error('Invalid email')
  return clean
}