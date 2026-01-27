export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

// Zod schemas for request validation
const createNoteSchema = z.object({
  codeAbbr: z.string().min(1),
  chapterNum: z.string().nullable().optional(),
  subchapter: z.string().nullable().optional(),
  content: z.string().min(1, 'Content is required'),
});

// GET /api/statutes/notes - List user's notes
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const codeAbbr = searchParams.get('codeAbbr');
    const chapterNum = searchParams.get('chapterNum');
    const subchapter = searchParams.get('subchapter');

    // Build filter
    const filter: {
      userId: string;
      codeAbbr?: string;
      chapterNum?: string | null;
      subchapter?: string | null;
    } = {
      userId: session.user.id,
    };

    if (codeAbbr) {
      filter.codeAbbr = codeAbbr;
      // Only filter by chapter/subchapter if code is specified
      if (chapterNum !== null) {
        filter.chapterNum = chapterNum || null;
        if (subchapter !== null) {
          filter.subchapter = subchapter || null;
        }
      }
    }

    // Get user's notes
    const notes = await prisma.statuteNote.findMany({
      where: filter,
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

// POST /api/statutes/notes - Create a new note
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const parseResult = createNoteSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { codeAbbr, chapterNum, subchapter, content } = parseResult.data;

    // Verify the code exists
    const code = await prisma.texasCode.findUnique({
      where: { abbreviation: codeAbbr },
    });

    if (!code) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    // Create the note
    const note = await prisma.statuteNote.create({
      data: {
        userId: session.user.id,
        codeAbbr,
        chapterNum: chapterNum ?? null,
        subchapter: subchapter ?? null,
        content,
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
