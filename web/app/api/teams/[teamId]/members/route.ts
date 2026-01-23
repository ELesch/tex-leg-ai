import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { getTeamMembership, TeamPermissions } from '@/lib/teams/permissions';

interface RouteParams {
  params: { teamId: string };
}

// GET /api/teams/[teamId]/members - List team members
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId } = params;

    // Check if user is a member
    const membership = await getTeamMembership(teamId, session.user.id);
    if (!membership) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const members = await prisma.teamMembership.findMany({
      where: { teamId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // Owner first
        { joinedAt: 'asc' },
      ],
    });

    return NextResponse.json({
      members: members.map(m => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
      currentUserRole: membership.role,
    });
  } catch (error) {
    console.error('Error fetching members:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/teams/[teamId]/members - Add member directly (by email)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId } = params;

    // Check membership and permissions
    const membership = await getTeamMembership(teamId, session.user.id);
    if (!membership) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (!TeamPermissions.canManageMembers(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, role } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['CONTRIBUTOR', 'REVIEWER', 'VIEWER', 'ADMIN'];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Non-owners cannot assign admin role
    if (role === 'ADMIN' && membership.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Only owners can assign admin role' },
        { status: 403 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, name: true, email: true, image: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found. They need to register first.' },
        { status: 404 }
      );
    }

    // Check if already a member
    const existingMembership = await prisma.teamMembership.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: user.id,
        },
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: 'User is already a member of this team' },
        { status: 409 }
      );
    }

    // Add member
    const newMembership = await prisma.teamMembership.create({
      data: {
        teamId,
        userId: user.id,
        role: role || 'CONTRIBUTOR',
      },
    });

    // Log activity
    await prisma.teamActivity.create({
      data: {
        teamId,
        userId: session.user.id,
        type: 'MEMBER_JOINED',
        entityType: 'member',
        entityId: user.id,
        metadata: {
          memberName: user.name,
          memberEmail: user.email,
          role: newMembership.role,
          addedBy: session.user.id,
        },
      },
    });

    return NextResponse.json(
      {
        member: {
          id: newMembership.id,
          userId: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: newMembership.role,
          joinedAt: newMembership.joinedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error adding member:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
