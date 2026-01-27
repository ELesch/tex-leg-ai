import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

// GET /api/notifications/preferences - Get user's notification preferences
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let preferences = await prisma.notificationPreference.findUnique({
      where: { userId: session.user.id },
    });

    // Create default preferences if not found
    if (!preferences) {
      preferences = await prisma.notificationPreference.create({
        data: {
          userId: session.user.id,
          enabled: false,
        },
      });
    }

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications/preferences - Update notification preferences
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      enabled,
      defaultStatusChange,
      defaultNewAction,
      defaultNewVersion,
      defaultHearingScheduled,
      defaultVoteRecorded,
    } = body;

    const preferences = await prisma.notificationPreference.upsert({
      where: { userId: session.user.id },
      update: {
        ...(enabled !== undefined && { enabled }),
        ...(defaultStatusChange !== undefined && { defaultStatusChange }),
        ...(defaultNewAction !== undefined && { defaultNewAction }),
        ...(defaultNewVersion !== undefined && { defaultNewVersion }),
        ...(defaultHearingScheduled !== undefined && { defaultHearingScheduled }),
        ...(defaultVoteRecorded !== undefined && { defaultVoteRecorded }),
      },
      create: {
        userId: session.user.id,
        enabled: enabled ?? false,
        defaultStatusChange: defaultStatusChange ?? true,
        defaultNewAction: defaultNewAction ?? true,
        defaultNewVersion: defaultNewVersion ?? true,
        defaultHearingScheduled: defaultHearingScheduled ?? true,
        defaultVoteRecorded: defaultVoteRecorded ?? true,
      },
    });

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
