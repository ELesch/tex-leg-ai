import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { contactId: string };
}

// GET /api/contacts/[contactId]/notes - Get notes for a contact
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactId } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Check ownership
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId: session.user.id,
      },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const [notes, total] = await Promise.all([
      prisma.contactNote.findMany({
        where: { contactId },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100),
        skip: offset,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.contactNote.count({ where: { contactId } }),
    ]);

    return NextResponse.json({
      notes: notes.map(n => ({
        id: n.id,
        content: n.content,
        mentions: n.mentions,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        user: n.user,
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching contact notes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/contacts/[contactId]/notes - Create a note for a contact
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactId } = params;

    // Check ownership
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId: session.user.id,
      },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const body = await request.json();
    const { content, mentions } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Note content is required' },
        { status: 400 }
      );
    }

    const note = await prisma.contactNote.create({
      data: {
        userId: session.user.id,
        contactId,
        content: content.trim(),
        mentions: mentions || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error('Error creating contact note:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/contacts/[contactId]/notes - Update a note
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactId } = params;
    const body = await request.json();
    const { noteId, content, mentions } = body;

    if (!noteId) {
      return NextResponse.json(
        { error: 'Note ID is required' },
        { status: 400 }
      );
    }

    // Check note ownership
    const existing = await prisma.contactNote.findFirst({
      where: {
        id: noteId,
        contactId,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const updateData: { content?: string; mentions?: typeof mentions } = {};

    if (content !== undefined) {
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return NextResponse.json(
          { error: 'Note content cannot be empty' },
          { status: 400 }
        );
      }
      updateData.content = content.trim();
    }
    if (mentions !== undefined) {
      updateData.mentions = mentions ?? null;
    }

    const note = await prisma.contactNote.update({
      where: { id: noteId },
      data: {
        ...updateData,
        mentions: updateData.mentions,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ note });
  } catch (error) {
    console.error('Error updating contact note:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/contacts/[contactId]/notes - Delete a note
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactId } = params;
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get('noteId');

    if (!noteId) {
      return NextResponse.json(
        { error: 'Note ID is required' },
        { status: 400 }
      );
    }

    // Check note ownership
    const existing = await prisma.contactNote.findFirst({
      where: {
        id: noteId,
        contactId,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    await prisma.contactNote.delete({
      where: { id: noteId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting contact note:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
