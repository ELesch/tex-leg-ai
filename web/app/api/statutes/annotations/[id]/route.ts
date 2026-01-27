export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

interface RouteParams {
  params: { id: string };
}

// Zod schema for update validation
const updateAnnotationSchema = z.object({
  content: z.string().min(1).optional(),
  type: z.enum(['NOTE', 'QUESTION', 'CONCERN', 'HIGHLIGHT']).optional(),
});

// PUT /api/statutes/annotations/[id] - Update an annotation
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();

    // Validate request body
    const parseResult = updateAnnotationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    // Find the annotation and verify ownership
    const existingAnnotation = await prisma.statuteAnnotation.findUnique({
      where: { id },
    });

    if (!existingAnnotation) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    if (existingAnnotation.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { content, type } = parseResult.data;

    // Build update data
    const updateData: { content?: string; type?: 'NOTE' | 'QUESTION' | 'CONCERN' | 'HIGHLIGHT' } = {};
    if (content !== undefined) updateData.content = content;
    if (type !== undefined) updateData.type = type;

    // Update the annotation
    const annotation = await prisma.statuteAnnotation.update({
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

// DELETE /api/statutes/annotations/[id] - Delete an annotation
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Find the annotation and verify ownership
    const existingAnnotation = await prisma.statuteAnnotation.findUnique({
      where: { id },
    });

    if (!existingAnnotation) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    if (existingAnnotation.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the annotation
    await prisma.statuteAnnotation.delete({
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
