import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { getTeamMembership, TeamPermissions, ROLE_HIERARCHY } from '@/lib/teams/permissions';

interface RouteParams {
  params: Promise<{ teamId: string; userId: string }>;
}

// PATCH /api/teams/[teamId]/members/[userId] - Update member role
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId, userId: targetUserId } = await params;

    // Check current user's membership and permissions
    const currentUserMembership = await getTeamMembership(teamId, session.user.id);
    if (!currentUserMembership) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (!TeamPermissions.canManageMembers(currentUserMembership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get target user's membership
    const targetMembership = await getTeamMembership(teamId, targetUserId);
    if (!targetMembership) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Cannot modify owner's role (except owner can transfer ownership)
    if (targetMembership.role === 'OWNER' && session.user.id !== targetUserId) {
      return NextResponse.json(
        { error: 'Cannot modify the owner\'s role' },
        { status: 403 }
      );
    }

    const { role } = await request.json();

    // Validate role
    const validRoles = ['CONTRIBUTOR', 'REVIEWER', 'VIEWER', 'ADMIN'];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Only owners can assign/remove admin role
    if ((role === 'ADMIN' || targetMembership.role === 'ADMIN') &&
        currentUserMembership.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Only owners can manage admin roles' },
        { status: 403 }
      );
    }

    // Cannot demote someone with equal or higher role (unless owner)
    if (currentUserMembership.role !== 'OWNER' &&
        ROLE_HIERARCHY[targetMembership.role] >= ROLE_HIERARCHY[currentUserMembership.role]) {
      return NextResponse.json(
        { error: 'Cannot modify role of member with equal or higher permissions' },
        { status: 403 }
      );
    }

    const updatedMembership = await prisma.teamMembership.update({
      where: {
        teamId_userId: {
          teamId,
          userId: targetUserId,
        },
      },
      data: { role },
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
    });

    return NextResponse.json({
      member: {
        id: updatedMembership.id,
        userId: updatedMembership.user.id,
        name: updatedMembership.user.name,
        email: updatedMembership.user.email,
        image: updatedMembership.user.image,
        role: updatedMembership.role,
        joinedAt: updatedMembership.joinedAt,
      },
    });
  } catch (error) {
    console.error('Error updating member:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[teamId]/members/[userId] - Remove member
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId, userId: targetUserId } = await params;

    // Check current user's membership and permissions
    const currentUserMembership = await getTeamMembership(teamId, session.user.id);
    if (!currentUserMembership) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Get target user's membership
    const targetMembership = await getTeamMembership(teamId, targetUserId);
    if (!targetMembership) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Owner cannot be removed
    if (targetMembership.role === 'OWNER') {
      return NextResponse.json(
        { error: 'Cannot remove the team owner' },
        { status: 403 }
      );
    }

    // User can remove themselves (leave team)
    const isSelf = session.user.id === targetUserId;

    // Otherwise need manage members permission
    if (!isSelf && !TeamPermissions.canManageMembers(currentUserMembership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Cannot remove someone with equal or higher role (unless owner or self)
    if (!isSelf && currentUserMembership.role !== 'OWNER' &&
        ROLE_HIERARCHY[targetMembership.role] >= ROLE_HIERARCHY[currentUserMembership.role]) {
      return NextResponse.json(
        { error: 'Cannot remove member with equal or higher permissions' },
        { status: 403 }
      );
    }

    // Remove member
    await prisma.teamMembership.delete({
      where: {
        teamId_userId: {
          teamId,
          userId: targetUserId,
        },
      },
    });

    // Log activity
    await prisma.teamActivity.create({
      data: {
        teamId,
        userId: session.user.id,
        type: 'MEMBER_LEFT',
        entityType: 'member',
        entityId: targetUserId,
        metadata: {
          removedBy: isSelf ? null : session.user.id,
          action: isSelf ? 'left' : 'removed',
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
