import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateRequestId, REQUEST_ID_HEADER, logger } from '@/lib/logger';

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
 * Check if a path should be excluded from logging
 */
function shouldExclude(pathname: string): boolean {
  return EXCLUDED_PATHS.some(path => pathname.startsWith(path));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip excluded paths
  if (shouldExclude(pathname)) {
    return NextResponse.next();
  }

  const startTime = Date.now();
  const requestId = request.headers.get(REQUEST_ID_HEADER) || generateRequestId();

  // Log request start
  logger.info('Request started', {
    requestId,
    path: pathname,
    method: request.method,
    query: Object.fromEntries(request.nextUrl.searchParams),
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
