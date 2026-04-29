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

  // Root path — redirect authenticated users to their role-based hub
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

      const { data: memberships } = await supabase
        .from('company_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('is_active', true);

      const roles = memberships?.map(m => m.role) ?? [];
      const hasOfficeAccess = roles.includes('admin') || roles.includes('office');
      const dest = hasOfficeAccess ? '/dashboard' : '/field';
      return NextResponse.redirect(new URL(dest, request.url));
    } catch {
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard', '/dashboard/:path*', '/field', '/field/:path*', '/capture', '/capture/:path*'],
};
