export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ billId: string }>;
}

// Validation schemas
const createNoteSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  sourceType: z.enum(['MANUAL', 'CHAT', 'TEAM_CHAT']).optional(),
  sourceId: z.string().optional(),
});

const updateNoteSchema = z.object({
  id: z.string().min(1, 'Note ID is required'),
  content: z.string().min(1, 'Content is required'),
});

// GET /api/bills/[billId]/notes - List user's notes for a bill
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { billId } = await params;

    // Find the bill by billId
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { id: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Get user's notes for this bill
    const notes = await prisma.personalNote.findMany({
      where: {
        userId: session.user.id,
        billId: bill.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Error fetching notes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/bills/[billId]/notes - Create a new note
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { billId } = await params;

    // Parse and validate request body
    const body = await request.json();
    const parseResult = createNoteSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0].message },
        { status: 400 }
      );
    }

    const { content, sourceType, sourceId } = parseResult.data;

    // Find the bill by billId
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { id: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Create the note
    const note = await prisma.personalNote.create({
      data: {
        userId: session.user.id,
        billId: bill.id,
        content,
        sourceType: sourceType || null,
        sourceId: sourceId || null,
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/bills/[billId]/notes - Update a note
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { billId } = await params;

    // Parse and validate request body
    const body = await request.json();
    const parseResult = updateNoteSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0].message },
        { status: 400 }
      );
    }

    const { id, content } = parseResult.data;

    // Find the bill by billId
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { id: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Find the note and verify ownership
    const existingNote = await prisma.personalNote.findFirst({
      where: {
        id,
        billId: bill.id,
      },
    });

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Only allow updating own notes
    if (existingNote.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only update your own notes' },
        { status: 403 }
      );
    }

    // Update the note
    const note = await prisma.personalNote.update({
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

// DELETE /api/bills/[billId]/notes - Delete a note
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { billId } = await params;
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get('id');

    if (!noteId) {
      return NextResponse.json(
        { error: 'Note ID is required' },
        { status: 400 }
      );
    }

    // Find the bill by billId
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { id: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Find the note and verify ownership
    const existingNote = await prisma.personalNote.findFirst({
      where: {
        id: noteId,
        billId: bill.id,
      },
    });

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Only allow deleting own notes
    if (existingNote.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only delete your own notes' },
        { status: 403 }
      );
    }

    // Delete the note
    await prisma.personalNote.delete({
      where: { id: noteId },
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
