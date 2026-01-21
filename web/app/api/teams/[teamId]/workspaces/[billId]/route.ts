import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { getTeamMembership, TeamPermissions } from '@/lib/teams/permissions';
import { WorkspaceStatus, WorkspacePriority, Prisma } from '@prisma/client';

interface RouteParams {
  params: Promise<{ teamId: string; billId: string }>;
}

// GET /api/teams/[teamId]/workspaces/[billId] - Get workspace details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId, billId } = await params;

    // Check membership
    const membership = await getTeamMembership(teamId, session.user.id);
    if (!membership) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Find the bill by billId string (e.g., "HB 123")
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { id: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    const workspace = await prisma.teamWorkspace.findUnique({
      where: {
        teamId_billId: {
          teamId,
          billId: bill.id,
        },
      },
      include: {
        bill: {
          include: {
            session: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
        annotations: {
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
          orderBy: { createdAt: 'desc' },
        },
        comments: {
          where: { parentId: null },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
            replies: {
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
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        chatSession: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            annotations: true,
            comments: true,
          },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get assignee details if set
    let assignee = null;
    if (workspace.assigneeId) {
      assignee = await prisma.user.findUnique({
        where: { id: workspace.assigneeId },
        select: { id: true, name: true, email: true, image: true },
      });
    }

    return NextResponse.json({
      workspace: {
        id: workspace.id,
        status: workspace.status,
        priority: workspace.priority,
        dueDate: workspace.dueDate,
        summary: workspace.summary,
        assignee,
        annotationCount: workspace._count.annotations,
        commentCount: workspace._count.comments,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
        bill: {
          id: workspace.bill.id,
          billId: workspace.bill.billId,
          billType: workspace.bill.billType,
          billNumber: workspace.bill.billNumber,
          description: workspace.bill.description,
          content: workspace.bill.content,
          status: workspace.bill.status,
          authors: workspace.bill.authors,
          subjects: workspace.bill.subjects,
          lastAction: workspace.bill.lastAction,
          lastActionDate: workspace.bill.lastActionDate,
          session: workspace.bill.session,
        },
        annotations: workspace.annotations,
        comments: workspace.comments,
        chatSession: workspace.chatSession,
      },
      currentUserRole: membership.role,
    });
  } catch (error) {
    console.error('Error fetching workspace:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/teams/[teamId]/workspaces/[billId] - Update workspace
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId, billId } = await params;

    // Check membership and permissions
    const membership = await getTeamMembership(teamId, session.user.id);
    if (!membership) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Find the bill
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { id: true, billId: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    const existingWorkspace = await prisma.teamWorkspace.findUnique({
      where: {
        teamId_billId: {
          teamId,
          billId: bill.id,
        },
      },
    });

    if (!existingWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const body = await request.json();
    const { status, priority, dueDate, assigneeId, summary } = body;

    // Permission checks
    if (status !== undefined && !TeamPermissions.canChangeStatus(membership.role)) {
      return NextResponse.json(
        { error: 'You do not have permission to change status' },
        { status: 403 }
      );
    }

    if (assigneeId !== undefined && !TeamPermissions.canAssignMembers(membership.role)) {
      return NextResponse.json(
        { error: 'You do not have permission to assign members' },
        { status: 403 }
      );
    }

    // If assigning someone, verify they are a team member
    if (assigneeId) {
      const assigneeMembership = await getTeamMembership(teamId, assigneeId);
      if (!assigneeMembership) {
        return NextResponse.json(
          { error: 'Assignee must be a team member' },
          { status: 400 }
        );
      }
    }

    const updateData: Prisma.TeamWorkspaceUpdateInput = {};

    if (status !== undefined) updateData.status = status as WorkspaceStatus;
    if (priority !== undefined) updateData.priority = priority as WorkspacePriority;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId || null;
    if (summary !== undefined) updateData.summary = summary?.trim() || null;

    const workspace = await prisma.teamWorkspace.update({
      where: {
        teamId_billId: {
          teamId,
          billId: bill.id,
        },
      },
      data: updateData,
    });

    // Log status change activity
    if (status !== undefined && status !== existingWorkspace.status) {
      await prisma.teamActivity.create({
        data: {
          teamId,
          userId: session.user.id,
          type: 'STATUS_CHANGED',
          entityType: 'workspace',
          entityId: workspace.id,
          metadata: {
            billId: bill.billId,
            oldStatus: existingWorkspace.status,
            newStatus: status,
          },
        },
      });
    }

    return NextResponse.json({
      workspace: {
        id: workspace.id,
        status: workspace.status,
        priority: workspace.priority,
        dueDate: workspace.dueDate,
        assigneeId: workspace.assigneeId,
        summary: workspace.summary,
        updatedAt: workspace.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating workspace:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[teamId]/workspaces/[billId] - Remove workspace
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId, billId } = await params;

    // Check membership and permissions
    const membership = await getTeamMembership(teamId, session.user.id);
    if (!membership) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (!TeamPermissions.canDeleteWorkspace(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find the bill
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { id: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    await prisma.teamWorkspace.delete({
      where: {
        teamId_billId: {
          teamId,
          billId: bill.id,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting workspace:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
