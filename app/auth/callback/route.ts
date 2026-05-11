import { createServerSideClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/login'
  const error = searchParams.get('error')
  const errorCode = searchParams.get('error_code')

  // Handle error params (expired/invalid links)
  if (error === 'access_denied' || errorCode === 'otp_expired') {
    return NextResponse.redirect(`${origin}/login?error=invalid-reset-link`)
  }

  if (code) {
    const supabase = await createServerSideClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (!exchangeError) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=invalid-reset-link`)
}