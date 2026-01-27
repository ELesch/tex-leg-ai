import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

// POST /api/notifications/subscription - Register a push subscription
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: 'Invalid subscription data' },
        { status: 400 }
      );
    }

    const userAgent = request.headers.get('user-agent') || undefined;

    // Upsert the subscription
    const subscription = await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId: session.user.id,
          endpoint,
        },
      },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
      },
      create: {
        userId: session.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
      },
    });

    // Also enable notifications in preferences if not already
    await prisma.notificationPreference.upsert({
      where: { userId: session.user.id },
      update: { enabled: true },
      create: {
        userId: session.user.id,
        enabled: true,
      },
    });

    return NextResponse.json({ subscription: { id: subscription.id } }, { status: 201 });
  } catch (error) {
    console.error('Error creating push subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications/subscription - Unregister a push subscription
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint required' },
        { status: 400 }
      );
    }

    await prisma.pushSubscription.deleteMany({
      where: {
        userId: session.user.id,
        endpoint,
      },
    });

    // Check if user has any remaining subscriptions
    const remainingCount = await prisma.pushSubscription.count({
      where: { userId: session.user.id },
    });

    // Disable notifications if no subscriptions left
    if (remainingCount === 0) {
      await prisma.notificationPreference.update({
        where: { userId: session.user.id },
        data: { enabled: false },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting push subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
