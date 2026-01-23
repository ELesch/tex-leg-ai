import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { logger, getClientIp, REQUEST_ID_HEADER } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Schema for client error payload
 */
const clientErrorSchema = z.object({
  message: z.string().min(1).max(5000),
  stack: z.string().max(10000).optional(),
  url: z.string().url().max(2000),
  userAgent: z.string().max(500),
  timestamp: z.string().datetime(),
  componentStack: z.string().max(10000).optional(),
});

/**
 * Simple in-memory rate limiter
 * Tracks error reports per IP with 1-minute window
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 errors per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count++;
  return false;
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  rateLimitMap.forEach((entry, ip) => {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  });
}, RATE_LIMIT_WINDOW_MS);

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request) || 'unknown';
    const requestId = request.headers.get(REQUEST_ID_HEADER);

    // Check rate limit
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many error reports' },
        { status: 429 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const result = clientErrorSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid error payload', details: result.error.flatten() },
        { status: 400 }
      );
    }

    // Get authenticated user if available
    const session = await auth();
    const userId = session?.user?.id;

    // Log the client error
    logger.error('Client error reported', {
      requestId,
      userId,
      ip,
      clientError: {
        message: result.data.message,
        url: result.data.url,
        userAgent: result.data.userAgent,
        timestamp: result.data.timestamp,
        hasStack: !!result.data.stack,
        hasComponentStack: !!result.data.componentStack,
      },
    });

    // Log full stack traces at debug level
    if (result.data.stack) {
      logger.debug('Client error stack trace', {
        requestId,
        stack: result.data.stack,
      });
    }

    if (result.data.componentStack) {
      logger.debug('Client error component stack', {
        requestId,
        componentStack: result.data.componentStack,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to process client error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
