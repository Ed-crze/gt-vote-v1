import { createClient } from '@/lib/supabase/client'

// Note: there is deliberately no hashStudentId here any more. The identity
// hash is derived in-database by handle_new_user() from a pepper the client
// never sees. A second implementation in TypeScript could only ever diverge
// from it — which is exactly what happened: /api/send-reminders re-hashed with
// NEXT_PUBLIC_HASH_SALT, matched nothing, and silently failed open.

export async function registerStudent({
  studentId,
  password,
  fullName,
  faculty,
  level,
}: {
  studentId: string
  password: string
  fullName: string
  faculty: string
  level: string
}) {
  const supabase = createClient()
  const email = `${studentId.toLowerCase().trim()}@live.gctu.edu.gh`

  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback`,
      // student_id_hash is NOT sent. handle_new_user() derives it in-database
      // from student_id; a client-supplied hash was ignored, and passing one
      // only invited someone to later trust the wrong value.
      data: {
        student_id: studentId.toUpperCase().trim(),
        full_name: fullName,
        faculty,
        level,
      }
    }
  })

  if (signUpError) throw signUpError

  // Detect confirmed duplicate
  if (data.user && data.user.identities?.length === 0) {
    throw new Error('already registered')
  }

  return data
}

// createStudentProfile() was removed. It inserted into students and
// voter_registry straight from the browser, which the corrective migration's
// RLS no longer permits — and both rows are created by handle_new_user()
// anyway. Nothing imported it.

export async function loginStudent(email: string, password: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut({ scope: 'global' })
}

// saveReceiptToSession() was removed deliberately. It wrote the ballot
// receipt into auth.users.raw_user_meta_data, which the corrective migration
// stripped precisely so a receipt cannot be recovered after submission. The
// receipt is now shown once, on the ballot success screen, and kept only in
// the student's own browser storage.
