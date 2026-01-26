import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateRequestId, REQUEST_ID_HEADER, logger } from '@/lib/logger';
import { getToken } from 'next-auth/jwt';

/**
 * Paths to exclude from request logging
 */
const EXCLUDED_PATHS = [
  '/_next',
  '/favicon.ico',
  '/api/health',
  '/__nextjs',
];

/**
 * API paths that should be rate limited for unauthenticated users
 */
const RATE_LIMITED_API_PATHS = [
  '/api/bills',
  '/bills',
  '/search',
  '/analytics',
];

/**
 * Rate limiting configuration for unauthenticated users
 */
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute for unauthenticated users

/**
 * Simple in-memory rate limit store
 * In production, consider using Redis or similar for distributed rate limiting
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Clean up old rate limit entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    rateLimitStore.forEach((entry, ip) => {
      if (now > entry.resetAt) {
        rateLimitStore.delete(ip);
      }
    });
  }, RATE_LIMIT_WINDOW_MS);
}

/**
 * Get client IP from request
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return 'unknown';
}

/**
 * Check if request is rate limited (returns remaining requests or -1 if limited)
 */
function checkRateLimit(ip: string): { limited: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { limited: false, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { limited: true, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { limited: false, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count, resetAt: entry.resetAt };
}

/**
 * Check if a path should be excluded from logging
 */
function shouldExclude(pathname: string): boolean {
  return EXCLUDED_PATHS.some(path => pathname.startsWith(path));
}

/**
 * Check if a path should be rate limited for unauthenticated users
 */
function shouldRateLimit(pathname: string): boolean {
  return RATE_LIMITED_API_PATHS.some(path => pathname.startsWith(path));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip excluded paths
  if (shouldExclude(pathname)) {
    return NextResponse.next();
  }

  const startTime = Date.now();
  const requestId = request.headers.get(REQUEST_ID_HEADER) || generateRequestId();

  // Check authentication status for rate limiting
  const token = await getToken({ req: request });
  const isAuthenticated = !!token;

  // Rate limit unauthenticated users on specific paths
  if (!isAuthenticated && shouldRateLimit(pathname)) {
    const clientIp = getClientIp(request);
    const { limited, remaining, resetAt } = checkRateLimit(clientIp);

    if (limited) {
      logger.warn('Rate limit exceeded', {
        requestId,
        path: pathname,
        ip: clientIp,
        resetAt: new Date(resetAt).toISOString(),
      });

      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          message: 'Please sign in for unlimited access or wait before making more requests.',
          retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
            [REQUEST_ID_HEADER]: requestId,
          },
        }
      );
    }
  }

  // Log request start
  logger.info('Request started', {
    requestId,
    path: pathname,
    method: request.method,
    query: Object.fromEntries(request.nextUrl.searchParams),
    authenticated: isAuthenticated,
  });

  // Clone the request headers and add request ID
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  // Create response with modified headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Add request ID to response headers
  response.headers.set(REQUEST_ID_HEADER, requestId);

  // Log request completion
  const duration = Date.now() - startTime;
  logger.info('Request completed', {
    requestId,
    path: pathname,
    method: request.method,
    duration,
  });

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
