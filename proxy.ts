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
   

   if (path === '/') {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  const protectedRoutes = ['/dashboard', '/ballot', '/candidates', '/verify']
  const adminRoutes = ['/admin/dashboard', '/admin/candidates', '/admin/voters', '/admin/settings']
  const authRoutes = ['/login', '/register']
  const publicRoutes = ['/reset-password', '/forgot-password', '/home', '/auth/callback', '/api', '/manifestos','/admin']

// Add this check before the protected routes check
if (publicRoutes.some(r => path.startsWith(r))) {
  return supabaseResponse
}

  if (!user && protectedRoutes.some(r => path.startsWith(r))) {
    const url = new URL('/login', request.url)
    url.searchParams.set('redirectTo', path)
    return NextResponse.redirect(url)
  }

  if (user && authRoutes.some(r => path.startsWith(r))) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (adminRoutes.some(r => path.startsWith(r))) {
    if (!user) return NextResponse.redirect(new URL('/admin', request.url))
    if (user.app_metadata?.role !== 'admin') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|gctu-crest.png|campus-bg.jpg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf|ico)$).*)',
  ],
}