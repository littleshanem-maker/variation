import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only intercept the root path — everything else routes normally
  if (pathname !== '/') return NextResponse.next();

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

    // Not logged in — serve the marketing landing page as normal
    if (!user) return response;

    // Logged in — check role and redirect directly, no flash
    const { data: membership } = await supabase
      .from('company_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .single();

    const role = membership?.role ?? 'field';
    const dest = role === 'field' ? '/field' : '/dashboard';
    return NextResponse.redirect(new URL(dest, request.url));
  } catch {
    return response;
  }
}

export const config = {
  matcher: ['/', '/field'],
};
