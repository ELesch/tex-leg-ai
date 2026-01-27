import { NextResponse } from 'next/server';
import { getVapidPublicKey } from '@/lib/notifications/push-service';

export const dynamic = 'force-dynamic';

// GET /api/notifications/vapid-key - Get VAPID public key for client subscription
export async function GET() {
  const publicKey = getVapidPublicKey();

  if (!publicKey) {
    return NextResponse.json(
      { error: 'Push notifications not configured' },
      { status: 503 }
    );
  }

  return NextResponse.json({ publicKey });
}
