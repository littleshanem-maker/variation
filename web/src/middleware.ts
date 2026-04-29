import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function isStagingRequest(request: NextRequest) {
  const env = (process.env.NEXT_PUBLIC_DEPLOY_ENV || process.env.VERCEL_ENV || '').toLowerCase();
  const host = request.headers.get('host') || '';
  return env === 'staging' || env === 'preview' || host.startsWith('staging.') || host.startsWith('v2.');
}

function stagingAuthResponse(request: NextRequest) {
  if (!isStagingRequest(request)) return null;

  const username = process.env.STAGING_BASIC_AUTH_USER;
  const password = process.env.STAGING_BASIC_AUTH_PASSWORD;

  if (!username || !password) {
    return new NextResponse('Staging access gate is not configured.', {
      status: 503,
      headers: {
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
      },
    });
  }

  const authHeader = request.headers.get('authorization');
  const expected = `Basic ${btoa(`${username}:${password}`)}`;

  if (authHeader !== expected) {
    return new NextResponse('Authentication required.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Variation Shield Staging"',
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
      },
    });
  }

  return null;
}

function withStagingHeaders(response: NextResponse, request: NextRequest) {
  if (isStagingRequest(request)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    response.headers.set('X-VariationShield-Environment', 'staging');
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const stagingAuth = stagingAuthResponse(request);
  if (stagingAuth) return stagingAuth;

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
        return withStagingHeaders(NextResponse.redirect(redirectUrl), request);
      }

      return withStagingHeaders(response, request);
    } catch {
      const redirectUrl = new URL('/login', request.url);
      return withStagingHeaders(NextResponse.redirect(redirectUrl), request);
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

      if (!user) return withStagingHeaders(response, request);

      return withStagingHeaders(NextResponse.redirect(new URL('/dashboard', request.url)), request);
    } catch {
      return withStagingHeaders(response, request);
    }
  }

  return withStagingHeaders(NextResponse.next(), request);
}

export const config = {
  matcher: [
    // Run on app/API routes and static public HTML pages, but not framework/image/assets.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|json|txt|webmanifest)$).*)',
  ],
};
