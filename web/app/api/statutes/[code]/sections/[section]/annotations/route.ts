export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

interface RouteParams {
  params: { code: string; section: string };
}

// Zod schemas for request validation
const createAnnotationSchema = z.object({
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().min(0),
  selectedText: z.string().min(1),
  content: z.string().min(1),
  type: z.enum(['NOTE', 'QUESTION', 'CONCERN', 'HIGHLIGHT']).default('NOTE'),
});

// GET /api/statutes/[code]/sections/[section]/annotations - List user's annotations for a section
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code, section } = params;
    const decodedSection = decodeURIComponent(section);

    // Find the code
    const texasCode = await prisma.texasCode.findUnique({
      where: { abbreviation: code },
      select: { id: true },
    });

    if (!texasCode) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    // Find the current statute section
    const statute = await prisma.statute.findFirst({
      where: {
        codeId: texasCode.id,
        sectionNum: decodedSection,
        isCurrent: true,
      },
      select: { id: true },
    });

    if (!statute) {
      return NextResponse.json({ error: 'Statute section not found' }, { status: 404 });
    }

    // Get user's annotations for this statute
    const annotations = await prisma.statuteAnnotation.findMany({
      where: {
        userId: session.user.id,
        statuteId: statute.id,
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

// POST /api/statutes/[code]/sections/[section]/annotations - Create a new annotation
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code, section } = params;
    const decodedSection = decodeURIComponent(section);
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

    // Find the code
    const texasCode = await prisma.texasCode.findUnique({
      where: { abbreviation: code },
      select: { id: true },
    });

    if (!texasCode) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    // Find the current statute section
    const statute = await prisma.statute.findFirst({
      where: {
        codeId: texasCode.id,
        sectionNum: decodedSection,
        isCurrent: true,
      },
      select: { id: true },
    });

    if (!statute) {
      return NextResponse.json({ error: 'Statute section not found' }, { status: 404 });
    }

    // Create the annotation
    const annotation = await prisma.statuteAnnotation.create({
      data: {
        userId: session.user.id,
        statuteId: statute.id,
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
