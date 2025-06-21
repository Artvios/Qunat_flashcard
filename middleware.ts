import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // If user is not signed in and trying to access protected routes, redirect to auth
  if (!session && req.nextUrl.pathname.startsWith('/study')) {
    return NextResponse.redirect(new URL('/auth', req.url))
  }

  // If user is signed in and trying to access auth page, redirect to study
  if (session && req.nextUrl.pathname === '/auth') {
    return NextResponse.redirect(new URL('/study', req.url))
  }

  return res
}

export const config = {
  matcher: ['/study/:path*', '/auth']
}