import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

interface RouteParams {
  params: Promise<{ token: string }>;
}

// GET /api/invitations/[token] - Get invitation details (public)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    const invitation = await prisma.teamInvitation.findUnique({
      where: { token },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            _count: {
              select: {
                memberships: true,
              },
            },
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 410 }
      );
    }

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        team: {
          id: invitation.team.id,
          name: invitation.team.name,
          slug: invitation.team.slug,
          description: invitation.team.description,
          memberCount: invitation.team._count.memberships,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/invitations/[token] - Accept invitation
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await params;

    const invitation = await prisma.teamInvitation.findUnique({
      where: { token },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 410 }
      );
    }

    // Check if user is already a member
    const existingMembership = await prisma.teamMembership.findUnique({
      where: {
        teamId_userId: {
          teamId: invitation.teamId,
          userId: session.user.id,
        },
      },
    });

    if (existingMembership) {
      // Delete the invitation since they're already a member
      await prisma.teamInvitation.delete({
        where: { id: invitation.id },
      });

      return NextResponse.json({
        message: 'You are already a member of this team',
        team: {
          id: invitation.team.id,
          name: invitation.team.name,
          slug: invitation.team.slug,
        },
        alreadyMember: true,
      });
    }

    // Create membership and delete invitation in a transaction
    const [membership] = await prisma.$transaction([
      prisma.teamMembership.create({
        data: {
          teamId: invitation.teamId,
          userId: session.user.id,
          role: invitation.role,
        },
      }),
      prisma.teamInvitation.delete({
        where: { id: invitation.id },
      }),
      prisma.teamActivity.create({
        data: {
          teamId: invitation.teamId,
          userId: session.user.id,
          type: 'MEMBER_JOINED',
          entityType: 'member',
          entityId: session.user.id,
          metadata: {
            role: invitation.role,
            joinedViaInvitation: true,
          },
        },
      }),
    ]);

    return NextResponse.json({
      message: 'Successfully joined team',
      team: {
        id: invitation.team.id,
        name: invitation.team.name,
        slug: invitation.team.slug,
      },
      membership: {
        role: membership.role,
        joinedAt: membership.joinedAt,
      },
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
