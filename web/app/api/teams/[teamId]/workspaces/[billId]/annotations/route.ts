import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { getTeamMembership, TeamPermissions } from '@/lib/teams/permissions';

interface RouteParams {
  params: { teamId: string; billId: string };
}

// GET /api/teams/[teamId]/workspaces/[billId]/annotations
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId, billId } = params;

    // Check membership
    const membership = await getTeamMembership(teamId, session.user.id);
    if (!membership) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Find the bill and workspace
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
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const annotations = await prisma.billAnnotation.findMany({
      where: { workspaceId: workspace.id },
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
      orderBy: { startOffset: 'asc' },
    });

    return NextResponse.json({ annotations });
  } catch (error) {
    console.error('Error fetching annotations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/teams/[teamId]/workspaces/[billId]/annotations
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId, billId } = params;

    // Check membership and permissions
    const membership = await getTeamMembership(teamId, session.user.id);
    if (!membership) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (!TeamPermissions.canAnnotate(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { startOffset, endOffset, selectedText, content, type } = await request.json();

    // Validate required fields
    if (typeof startOffset !== 'number' || typeof endOffset !== 'number') {
      return NextResponse.json(
        { error: 'Start and end offsets are required' },
        { status: 400 }
      );
    }

    if (!selectedText || typeof selectedText !== 'string') {
      return NextResponse.json(
        { error: 'Selected text is required' },
        { status: 400 }
      );
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json(
        { error: 'Annotation content is required' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['NOTE', 'QUESTION', 'CONCERN', 'HIGHLIGHT'];
    const annotationType = type || 'NOTE';
    if (!validTypes.includes(annotationType)) {
      return NextResponse.json(
        { error: 'Invalid annotation type' },
        { status: 400 }
      );
    }

    // Find the bill and workspace
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { id: true, billId: true },
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
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const annotation = await prisma.billAnnotation.create({
      data: {
        workspaceId: workspace.id,
        userId: session.user.id,
        startOffset,
        endOffset,
        selectedText,
        content: content.trim(),
        type: annotationType,
      },
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

    // Log activity
    await prisma.teamActivity.create({
      data: {
        teamId,
        userId: session.user.id,
        type: 'ANNOTATION_ADDED',
        entityType: 'annotation',
        entityId: annotation.id,
        metadata: {
          billId: bill.billId,
          type: annotationType,
          textPreview: selectedText.substring(0, 100),
        },
      },
    });

    return NextResponse.json({ annotation }, { status: 201 });
  } catch (error) {
    console.error('Error creating annotation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/teams/[teamId]/workspaces/[billId]/annotations
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId, billId } = params;

    // Check membership
    const membership = await getTeamMembership(teamId, session.user.id);
    if (!membership) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const { annotationId, resolved, content } = await request.json();

    if (!annotationId) {
      return NextResponse.json(
        { error: 'Annotation ID is required' },
        { status: 400 }
      );
    }

    // Find the bill and workspace
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
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Find annotation
    const annotation = await prisma.billAnnotation.findFirst({
      where: {
        id: annotationId,
        workspaceId: workspace.id,
      },
    });

    if (!annotation) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    // Permission checks
    const isOwn = annotation.userId === session.user.id;

    // Resolving requires REVIEWER+ role
    if (resolved !== undefined && !TeamPermissions.canResolveAnnotations(membership.role)) {
      return NextResponse.json(
        { error: 'You do not have permission to resolve annotations' },
        { status: 403 }
      );
    }

    // Editing content requires being the owner
    if (content !== undefined && !isOwn) {
      return NextResponse.json(
        { error: 'You can only edit your own annotations' },
        { status: 403 }
      );
    }

    const updateData: { resolved?: boolean; content?: string } = {};
    if (resolved !== undefined) updateData.resolved = resolved;
    if (content !== undefined) updateData.content = content.trim();

    const updatedAnnotation = await prisma.billAnnotation.update({
      where: { id: annotationId },
      data: updateData,
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

    return NextResponse.json({ annotation: updatedAnnotation });
  } catch (error) {
    console.error('Error updating annotation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[teamId]/workspaces/[billId]/annotations
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId, billId } = params;

    // Check membership
    const membership = await getTeamMembership(teamId, session.user.id);
    if (!membership) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const { annotationId } = await request.json();

    if (!annotationId) {
      return NextResponse.json(
        { error: 'Annotation ID is required' },
        { status: 400 }
      );
    }

    // Find the bill and workspace
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
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Find annotation
    const annotation = await prisma.billAnnotation.findFirst({
      where: {
        id: annotationId,
        workspaceId: workspace.id,
      },
    });

    if (!annotation) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    // Users can delete their own, admins can delete any
    const isOwn = annotation.userId === session.user.id;
    const isAdmin = membership.role === 'ADMIN' || membership.role === 'OWNER';

    if (!isOwn && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.billAnnotation.delete({
      where: { id: annotationId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting annotation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
