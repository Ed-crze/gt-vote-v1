import { createServerSideClient } from '@/lib/supabase/server'

// Get current session (server side)
export async function getSession() {
  const supabase = await createServerSideClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// Get current student profile (server side)
export async function getStudentProfile() {
  const supabase = await createServerSideClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('students')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}