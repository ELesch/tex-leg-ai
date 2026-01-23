export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

// Zod schemas for request validation
const createAnnotationSchema = z.object({
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().min(0),
  selectedText: z.string().min(1),
  content: z.string().min(1),
  type: z.enum(['NOTE', 'QUESTION', 'CONCERN', 'HIGHLIGHT']).optional().default('NOTE'),
});

const updateAnnotationSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1).optional(),
  type: z.enum(['NOTE', 'QUESTION', 'CONCERN', 'HIGHLIGHT']).optional(),
});

// GET /api/bills/[billId]/annotations - List user's annotations for a bill
export async function GET(
  request: NextRequest,
  { params }: { params: { billId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { billId } = params;

    // Find the bill by billId (e.g., "HB 123")
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { id: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Get user's annotations for this bill
    const annotations = await prisma.personalAnnotation.findMany({
      where: {
        userId: session.user.id,
        billId: bill.id,
      },
      orderBy: { createdAt: 'desc' },
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

// POST /api/bills/[billId]/annotations - Create a new annotation
export async function POST(
  request: NextRequest,
  { params }: { params: { billId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { billId } = params;
    const body = await request.json();

    // Validate request body
    const parseResult = createAnnotationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { startOffset, endOffset, selectedText, content, type } = parseResult.data;

    // Find the bill by billId (e.g., "HB 123")
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { id: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Create the annotation
    const annotation = await prisma.personalAnnotation.create({
      data: {
        userId: session.user.id,
        billId: bill.id,
        startOffset,
        endOffset,
        selectedText,
        content,
        type,
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

// PATCH /api/bills/[billId]/annotations - Update an annotation
export async function PATCH(
  request: NextRequest,
  { params }: { params: { billId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { billId } = params;
    const body = await request.json();

    // Validate request body
    const parseResult = updateAnnotationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { id, content, type } = parseResult.data;

    // Find the bill by billId (e.g., "HB 123")
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { id: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Find the annotation and verify ownership
    const existingAnnotation = await prisma.personalAnnotation.findUnique({
      where: { id },
    });

    if (!existingAnnotation) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    if (existingAnnotation.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (existingAnnotation.billId !== bill.id) {
      return NextResponse.json({ error: 'Annotation does not belong to this bill' }, { status: 400 });
    }

    // Build update data
    const updateData: { content?: string; type?: 'NOTE' | 'QUESTION' | 'CONCERN' | 'HIGHLIGHT' } = {};
    if (content !== undefined) updateData.content = content;
    if (type !== undefined) updateData.type = type;

    // Update the annotation
    const annotation = await prisma.personalAnnotation.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ annotation });
  } catch (error) {
    console.error('Error updating annotation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/bills/[billId]/annotations - Delete an annotation
export async function DELETE(
  request: NextRequest,
  { params }: { params: { billId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { billId } = params;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Annotation ID required (use ?id=xxx query param)' },
        { status: 400 }
      );
    }

    // Find the bill by billId (e.g., "HB 123")
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { id: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Find the annotation and verify ownership
    const existingAnnotation = await prisma.personalAnnotation.findUnique({
      where: { id },
    });

    if (!existingAnnotation) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    if (existingAnnotation.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (existingAnnotation.billId !== bill.id) {
      return NextResponse.json({ error: 'Annotation does not belong to this bill' }, { status: 400 });
    }

    // Delete the annotation
    await prisma.personalAnnotation.delete({
      where: { id },
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
