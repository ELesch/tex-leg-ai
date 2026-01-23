import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { getTeamMembership } from '@/lib/teams/permissions';

interface RouteParams {
  params: { teamId: string };
}

// GET /api/teams/[teamId]/activities
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId } = params;

    // Check membership
    const membership = await getTeamMembership(teamId, session.user.id);
    if (!membership) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const cursor = searchParams.get('cursor');

    const activities = await prisma.teamActivity.findMany({
      where: {
        teamId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      take: limit + 1,
      orderBy: { createdAt: 'desc' },
    });

    // Get user details for activities
    const userIds = Array.from(new Set(activities.map((a) => a.userId)));
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const hasMore = activities.length > limit;
    const items = hasMore ? activities.slice(0, -1) : activities;

    return NextResponse.json({
      activities: items.map((activity) => ({
        id: activity.id,
        type: activity.type,
        entityType: activity.entityType,
        entityId: activity.entityId,
        metadata: activity.metadata,
        createdAt: activity.createdAt,
        user: userMap.get(activity.userId) || null,
      })),
      hasMore,
      nextCursor: hasMore ? items[items.length - 1].createdAt.toISOString() : null,
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
