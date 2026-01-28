import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

// GET - Get session with messages
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;

    const chatSession = await prisma.statuteChatSession.findUnique({
      where: { id: sessionId, userId: session.user.id },
      include: {
        bill: {
          select: {
            id: true,
            billId: true,
            description: true,
            status: true,
            authors: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!chatSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      session: {
        id: chatSession.id,
        title: chatSession.title,
        codeAbbr: chatSession.codeAbbr,
        chapterNum: chatSession.chapterNum,
        subchapter: chatSession.subchapter,
        bill: chatSession.bill ? {
          id: chatSession.bill.id,
          billId: chatSession.bill.billId,
          description: chatSession.bill.description,
          status: chatSession.bill.status,
          authors: chatSession.bill.authors,
        } : null,
        createdAt: chatSession.createdAt.toISOString(),
        updatedAt: chatSession.updatedAt.toISOString(),
      },
      messages: chatSession.messages.map(m => ({
        id: m.id,
        role: m.role.toLowerCase(),
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error getting statute chat session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update session (rename)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    const { title } = await request.json();

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title required' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.statuteChatSession.findUnique({
      where: { id: sessionId, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const updated = await prisma.statuteChatSession.update({
      where: { id: sessionId },
      data: { title: title.trim() },
    });

    return NextResponse.json({
      session: {
        id: updated.id,
        title: updated.title,
        codeAbbr: updated.codeAbbr,
        chapterNum: updated.chapterNum,
        subchapter: updated.subchapter,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error updating statute chat session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete session
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;

    // Verify ownership
    const existing = await prisma.statuteChatSession.findUnique({
      where: { id: sessionId, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    await prisma.statuteChatSession.delete({
      where: { id: sessionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting statute chat session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
