import { createClient } from '@/lib/supabase/client'
import { hashStudentId } from '@/lib/auth'

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
  const hash = await hashStudentId(studentId)

  // Supabase trigger handles students + voter_registry insert automatically
  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback`,
      data: {
        student_id: studentId.toUpperCase().trim(),
        full_name: fullName,
        faculty,
        level,
        student_id_hash: hash, // passed to trigger for voter_registry
      }
    }
  })
  if (signUpError) throw signUpError

  if (data.user) {
    const { error: profileError } = await supabase
      .from('students')
      .insert({
        id: data.user.id,
        student_id: studentId.toUpperCase().trim(),
        full_name: fullName,
        email,
        faculty,
        level,
      })
    if (profileError) throw profileError

    const hash = await hashStudentId(studentId)
    const { error: registryError } = await supabase
      .from('voter_registry')
      .insert({ student_id_hash: hash, has_voted: false })
    if (registryError) throw registryError
  }

  return data
}

export async function loginStudent(email: string, password: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const supabase = createClient()
  // Sign out from ALL sessions, not just current one
  await supabase.auth.signOut({ scope: 'global' })
}

export async function saveReceiptToSession(receiptCode: string) {
  const supabase = createClient()
  await supabase.auth.updateUser({
    data: { receipt_code: receiptCode }
  })
}

export { hashStudentId } from '@/lib/auth'