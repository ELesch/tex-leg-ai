export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

// Zod schema for update validation
const updatePreferencesSchema = z.object({
  hideRevisionHistory: z.boolean().optional(),
});

// GET /api/statutes/preferences - Get user's statute view preferences
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's preferences (or defaults if none exist)
    let preferences = await prisma.statuteViewPreference.findUnique({
      where: { userId: session.user.id },
    });

    // Return default preferences if none exist
    if (!preferences) {
      preferences = {
        id: '',
        userId: session.user.id,
        hideRevisionHistory: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/statutes/preferences - Update user's statute view preferences
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const parseResult = updatePreferencesSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { hideRevisionHistory } = parseResult.data;

    // Build update data
    const updateData: { hideRevisionHistory?: boolean } = {};
    if (hideRevisionHistory !== undefined) updateData.hideRevisionHistory = hideRevisionHistory;

    // Upsert the preferences
    const preferences = await prisma.statuteViewPreference.upsert({
      where: { userId: session.user.id },
      update: updateData,
      create: {
        userId: session.user.id,
        ...updateData,
      },
    });

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Error updating preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
