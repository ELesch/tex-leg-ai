import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import {
  getTeamMembership,
  TeamPermissions,
  generateSlug,
  ensureUniqueSlug,
} from '@/lib/teams/permissions';

interface RouteParams {
  params: Promise<{ teamId: string }>;
}

// GET /api/teams/[teamId] - Get team details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId } = await params;

    // Check if user is a member
    const membership = await getTeamMembership(teamId, session.user.id);
    if (!membership) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        memberships: {
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
          orderBy: { joinedAt: 'asc' },
        },
        workspaces: {
          include: {
            bill: {
              select: {
                id: true,
                billId: true,
                billType: true,
                billNumber: true,
                description: true,
                status: true,
              },
            },
            _count: {
              select: {
                annotations: true,
                comments: true,
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            memberships: true,
            workspaces: true,
            activities: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Hide sensitive data (AI API key) unless admin
    const canViewSettings = TeamPermissions.canChangeAiSettings(membership.role);

    return NextResponse.json({
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
        slug: team.slug,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
        // Only show AI settings to admins
        aiProvider: canViewSettings ? team.aiProvider : undefined,
        aiModel: canViewSettings ? team.aiModel : undefined,
        hasApiKey: !!team.aiApiKey,
        memberCount: team._count.memberships,
        workspaceCount: team._count.workspaces,
        activityCount: team._count.activities,
        currentUserRole: membership.role,
        members: team.memberships.map(m => ({
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
        recentWorkspaces: team.workspaces.map(w => ({
          id: w.id,
          billId: w.bill.billId,
          billDescription: w.bill.description,
          status: w.status,
          priority: w.priority,
          dueDate: w.dueDate,
          annotationCount: w._count.annotations,
          commentCount: w._count.comments,
          updatedAt: w.updatedAt,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/teams/[teamId] - Update team
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId } = await params;

    // Check membership and permissions
    const membership = await getTeamMembership(teamId, session.user.id);
    if (!membership) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (!TeamPermissions.canEditTeam(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, aiProvider, aiModel, aiApiKey } = body;

    const updateData: {
      name?: string;
      description?: string | null;
      slug?: string;
      aiProvider?: string | null;
      aiModel?: string | null;
      aiApiKey?: string | null;
    } = {};

    // Update name and regenerate slug if needed
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Team name cannot be empty' },
          { status: 400 }
        );
      }
      if (name.length > 100) {
        return NextResponse.json(
          { error: 'Team name must be less than 100 characters' },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
      const baseSlug = generateSlug(name.trim());
      updateData.slug = await ensureUniqueSlug(baseSlug, teamId);
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    // AI settings (only admins can change)
    if (TeamPermissions.canChangeAiSettings(membership.role)) {
      if (aiProvider !== undefined) {
        updateData.aiProvider = aiProvider || null;
      }
      if (aiModel !== undefined) {
        updateData.aiModel = aiModel || null;
      }
      if (aiApiKey !== undefined) {
        updateData.aiApiKey = aiApiKey || null;
      }
    }

    const team = await prisma.team.update({
      where: { id: teamId },
      data: updateData,
      select: {
        id: true,
        name: true,
        description: true,
        slug: true,
        aiProvider: true,
        aiModel: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      team: {
        ...team,
        hasApiKey: !!updateData.aiApiKey || undefined,
      },
    });
  } catch (error) {
    console.error('Error updating team:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[teamId] - Delete team
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId } = await params;

    // Check membership and permissions
    const membership = await getTeamMembership(teamId, session.user.id);
    if (!membership) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (!TeamPermissions.canDeleteTeam(membership.role)) {
      return NextResponse.json(
        { error: 'Only the team owner can delete the team' },
        { status: 403 }
      );
    }

    // Delete the team (cascades to all related records)
    await prisma.team.delete({
      where: { id: teamId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting team:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
