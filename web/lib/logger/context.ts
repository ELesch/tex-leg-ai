import { NextRequest } from 'next/server';
import { logger } from './logger';

/**
 * Header name for request ID
 */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${random}`;
}

/**
 * Extract client IP from request headers
 */
export function getClientIp(request: NextRequest): string | undefined {
  // Check x-forwarded-for (set by proxies/load balancers)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP (original client)
    return forwardedFor.split(',')[0].trim();
  }

  // Check x-real-ip (set by some proxies)
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return undefined;
}

/**
 * Create a logger with request context
 */
export function createRequestLogger(request: NextRequest, userId?: string) {
  const requestId = request.headers.get(REQUEST_ID_HEADER) || generateRequestId();
  const url = new URL(request.url);

  return logger.child({
    requestId,
    userId,
    path: url.pathname,
    method: request.method,
    ip: getClientIp(request),
  });
}
