import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              secure: true, // always true — Vercel always uses HTTPS
              sameSite: 'lax',
            })
          )
        }
      }
    }
  )


  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  const protectedRoutes = ['/dashboard', '/ballot', '/candidates', '/verify']
  const adminRoutes = ['/admin/dashboard', '/admin/candidates', '/admin/voters', '/admin/settings']
  const authRoutes = ['/login', '/register']
  const publicRoutes = ['/reset-password', '/home', '/auth/callback', '/api', '/manifestos']

// Add this check before the protected routes check
if (publicRoutes.some(r => path.startsWith(r))) {
  return supabaseResponse
}

  // Not logged in trying to access protected route → send to login
  if (!user && protectedRoutes.some(r => path.startsWith(r))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Logged in trying to access login/register → send to dashboard
  if (user && authRoutes.some(r => path.startsWith(r))) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Admin routes → handled separately in Step 5

  if (adminRoutes.some(r => path.startsWith(r))) {
  if (!user) return NextResponse.redirect(new URL('/admin', request.url))

  const role = user.app_metadata?.role
  if (role !== 'admin') {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

return supabaseResponse

}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}