import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { getTeamMembership, TeamPermissions } from '@/lib/teams/permissions';

interface RouteParams {
  params: { teamId: string };
}

// GET /api/teams/[teamId]/invitations - List pending invitations
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const invitations = await prisma.teamInvitation.findMany({
      where: {
        teamId,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      invitations: invitations.map(inv => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        token: inv.token,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/teams/[teamId]/invitations - Create invitation link
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

    if (!TeamPermissions.canInviteMembers(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, role, expiresInDays = 7 } = await request.json();

    // Validate role
    const validRoles = ['CONTRIBUTOR', 'REVIEWER', 'VIEWER', 'ADMIN'];
    const inviteRole = role || 'CONTRIBUTOR';
    if (!validRoles.includes(inviteRole)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Non-owners cannot assign admin role
    if (inviteRole === 'ADMIN' && membership.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Only owners can invite admins' },
        { status: 403 }
      );
    }

    // Check if user is already a member
    if (email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
        select: { id: true },
      });

      if (existingUser) {
        const existingMembership = await prisma.teamMembership.findUnique({
          where: {
            teamId_userId: {
              teamId,
              userId: existingUser.id,
            },
          },
        });

        if (existingMembership) {
          return NextResponse.json(
            { error: 'User is already a member of this team' },
            { status: 409 }
          );
        }
      }
    }

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Math.min(Math.max(expiresInDays, 1), 30));

    // Create invitation
    const invitation = await prisma.teamInvitation.create({
      data: {
        teamId,
        email: email?.toLowerCase().trim() || '',
        role: inviteRole,
        expiresAt,
        createdBy: session.user.id,
      },
      include: {
        team: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    // Generate invite URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/invitations/${invitation.token}`;

    return NextResponse.json(
      {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          token: invitation.token,
          expiresAt: invitation.expiresAt,
          inviteUrl,
          teamName: invitation.team.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[teamId]/invitations - Revoke invitation
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    if (!TeamPermissions.canInviteMembers(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { invitationId } = await request.json();

    if (!invitationId) {
      return NextResponse.json(
        { error: 'Invitation ID required' },
        { status: 400 }
      );
    }

    // Verify invitation belongs to this team
    const invitation = await prisma.teamInvitation.findFirst({
      where: {
        id: invitationId,
        teamId,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    await prisma.teamInvitation.delete({
      where: { id: invitationId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
