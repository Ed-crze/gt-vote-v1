// This file only exports hashStudentId which is safe to import anywhere
// All other functions have been moved to auth-client.ts and auth-server.ts

export async function hashStudentId(studentId: string): Promise<string> {
  // Server-side uses HASH_SALT, client-side fallback
  const salt = process.env.HASH_SALT ||
               process.env.NEXT_PUBLIC_HASH_SALT ||
               'gt-vote-2025'
  const encoder = new TextEncoder()
  const data = encoder.encode(salt + studentId.toUpperCase().trim())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}