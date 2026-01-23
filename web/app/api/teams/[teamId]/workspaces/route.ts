import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { getTeamMembership, TeamPermissions } from '@/lib/teams/permissions';
import { WorkspaceStatus, WorkspacePriority, Prisma } from '@prisma/client';

interface RouteParams {
  params: { teamId: string };
}

// GET /api/teams/[teamId]/workspaces - List team workspaces
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
    const status = searchParams.get('status') as WorkspaceStatus | null;
    const priority = searchParams.get('priority') as WorkspacePriority | null;

    const where: Prisma.TeamWorkspaceWhereInput = { teamId };
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const workspaces = await prisma.teamWorkspace.findMany({
      where,
      include: {
        bill: {
          select: {
            id: true,
            billId: true,
            billType: true,
            billNumber: true,
            description: true,
            status: true,
            lastAction: true,
            lastActionDate: true,
          },
        },
        _count: {
          select: {
            annotations: true,
            comments: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { updatedAt: 'desc' },
      ],
    });

    // Get assignee names
    const assigneeIds = workspaces
      .map(w => w.assigneeId)
      .filter((id): id is string => !!id);

    const assignees = assigneeIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true },
        })
      : [];

    const assigneeMap = new Map(assignees.map(a => [a.id, a.name]));

    return NextResponse.json({
      workspaces: workspaces.map(w => ({
        id: w.id,
        billId: w.bill.billId,
        billDbId: w.bill.id,
        billType: w.bill.billType,
        billNumber: w.bill.billNumber,
        billDescription: w.bill.description,
        billStatus: w.bill.status,
        status: w.status,
        priority: w.priority,
        dueDate: w.dueDate,
        assigneeId: w.assigneeId,
        assigneeName: w.assigneeId ? assigneeMap.get(w.assigneeId) : null,
        summary: w.summary,
        annotationCount: w._count.annotations,
        commentCount: w._count.comments,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/teams/[teamId]/workspaces - Add bill to team workspace
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

    if (!TeamPermissions.canCreateWorkspace(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { billId, priority, dueDate, summary } = await request.json();

    if (!billId) {
      return NextResponse.json(
        { error: 'Bill ID is required' },
        { status: 400 }
      );
    }

    // Find the bill (billId is the string like "HB 123")
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { id: true, billId: true, description: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Check if already in workspace
    const existing = await prisma.teamWorkspace.findUnique({
      where: {
        teamId_billId: {
          teamId,
          billId: bill.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Bill is already in this team\'s workspace' },
        { status: 409 }
      );
    }

    // Create workspace
    const workspace = await prisma.teamWorkspace.create({
      data: {
        teamId,
        billId: bill.id,
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        summary: summary?.trim() || null,
      },
      include: {
        bill: {
          select: {
            id: true,
            billId: true,
            description: true,
          },
        },
      },
    });

    // Log activity
    await prisma.teamActivity.create({
      data: {
        teamId,
        userId: session.user.id,
        type: 'WORKSPACE_CREATED',
        entityType: 'workspace',
        entityId: workspace.id,
        metadata: {
          billId: bill.billId,
          billDescription: bill.description,
        },
      },
    });

    return NextResponse.json(
      {
        workspace: {
          id: workspace.id,
          billId: workspace.bill.billId,
          billDescription: workspace.bill.description,
          status: workspace.status,
          priority: workspace.priority,
          dueDate: workspace.dueDate,
          createdAt: workspace.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating workspace:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
