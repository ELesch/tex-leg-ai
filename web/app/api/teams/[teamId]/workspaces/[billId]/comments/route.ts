import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { getTeamMembership, TeamPermissions } from '@/lib/teams/permissions';

interface RouteParams {
  params: { teamId: string; billId: string };
}

// GET /api/teams/[teamId]/workspaces/[billId]/comments
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

    const comments = await prisma.workspaceComment.findMany({
      where: {
        workspaceId: workspace.id,
        parentId: null, // Only top-level comments
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
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/teams/[teamId]/workspaces/[billId]/comments
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

    if (!TeamPermissions.canComment(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { content, parentId } = await request.json();

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json(
        { error: 'Comment content is required' },
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

    // If replying, verify parent comment exists and belongs to this workspace
    if (parentId) {
      const parentComment = await prisma.workspaceComment.findFirst({
        where: {
          id: parentId,
          workspaceId: workspace.id,
        },
      });

      if (!parentComment) {
        return NextResponse.json(
          { error: 'Parent comment not found' },
          { status: 404 }
        );
      }
    }

    const comment = await prisma.workspaceComment.create({
      data: {
        workspaceId: workspace.id,
        userId: session.user.id,
        content: content.trim(),
        parentId: parentId || null,
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
        type: 'COMMENT_ADDED',
        entityType: 'comment',
        entityId: comment.id,
        metadata: {
          billId: bill.billId,
          isReply: !!parentId,
          contentPreview: content.trim().substring(0, 100),
        },
      },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[teamId]/workspaces/[billId]/comments
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

    const { commentId } = await request.json();

    if (!commentId) {
      return NextResponse.json(
        { error: 'Comment ID is required' },
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

    // Find the comment
    const comment = await prisma.workspaceComment.findFirst({
      where: {
        id: commentId,
        workspaceId: workspace.id,
      },
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Users can delete their own comments, admins can delete any
    const isOwn = comment.userId === session.user.id;
    const isAdmin = membership.role === 'ADMIN' || membership.role === 'OWNER';

    if (!isOwn && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete comment (will cascade to replies)
    await prisma.workspaceComment.delete({
      where: { id: commentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
