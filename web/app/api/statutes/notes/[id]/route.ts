export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

interface RouteParams {
  params: { id: string };
}

// Zod schema for update validation
const updateNoteSchema = z.object({
  content: z.string().min(1, 'Content is required'),
});

// PUT /api/statutes/notes/[id] - Update a note
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();

    // Validate request body
    const parseResult = updateNoteSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    // Find the note and verify ownership
    const existingNote = await prisma.statuteNote.findUnique({
      where: { id },
    });

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (existingNote.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { content } = parseResult.data;

    // Update the note
    const note = await prisma.statuteNote.update({
      where: { id },
      data: { content },
    });

    return NextResponse.json({ note });
  } catch (error) {
    console.error('Error updating note:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/statutes/notes/[id] - Delete a note
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Find the note and verify ownership
    const existingNote = await prisma.statuteNote.findUnique({
      where: { id },
    });

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (existingNote.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the note
    await prisma.statuteNote.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting note:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
