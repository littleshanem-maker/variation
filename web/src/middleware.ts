import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect app routes — require auth or redirect to login
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/field') || pathname.startsWith('/capture')) {
    const response = NextResponse.next();

    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return request.cookies.getAll(); },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) =>
                response.cookies.set(name, value, options)
              );
            },
          },
        }
      );

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        const redirectUrl = new URL('/login', request.url);
        return NextResponse.redirect(redirectUrl);
      }

      return response;
    } catch {
      const redirectUrl = new URL('/login', request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Root path — redirect authenticated users to dashboard.
  // Avoid role-based routing here: role lookup can fail under RLS and should never dump users into capture.
  if (pathname === '/') {
    const response = NextResponse.next();

    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return request.cookies.getAll(); },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) =>
                response.cookies.set(name, value, options)
              );
            },
          },
        }
      );

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return response;

      return NextResponse.redirect(new URL('/dashboard', request.url));
    } catch {
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard', '/dashboard/:path*', '/field', '/field/:path*', '/capture', '/capture/:path*'],
};
