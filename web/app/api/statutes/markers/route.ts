export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

// Zod schemas for request validation
const createMarkerSchema = z.object({
  codeAbbr: z.string().min(1),
  chapterNum: z.string().nullable().optional(),
  subchapter: z.string().nullable().optional(),
  color: z.enum(['RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE', 'PURPLE']).default('YELLOW'),
  label: z.string().nullable().optional(),
});

// GET /api/statutes/markers - List user's markers
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const codeAbbr = searchParams.get('codeAbbr');

    // Get user's markers, optionally filtered by code
    const markers = await prisma.statuteMarker.findMany({
      where: {
        userId: session.user.id,
        ...(codeAbbr ? { codeAbbr } : {}),
      },
      orderBy: [
        { codeAbbr: 'asc' },
        { chapterNum: 'asc' },
        { subchapter: 'asc' },
      ],
    });

    return NextResponse.json({ markers });
  } catch (error) {
    console.error('Error fetching markers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/statutes/markers - Create a new marker
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const parseResult = createMarkerSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { codeAbbr, chapterNum, subchapter, color, label } = parseResult.data;

    // Verify the code exists
    const code = await prisma.texasCode.findUnique({
      where: { abbreviation: codeAbbr },
    });

    if (!code) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    // Upsert the marker (update if exists, create if not)
    // Note: Prisma compound unique with nullable fields requires explicit typing
    const marker = await prisma.statuteMarker.upsert({
      where: {
        userId_codeAbbr_chapterNum_subchapter: {
          userId: session.user.id,
          codeAbbr,
          chapterNum: (chapterNum ?? null) as string,
          subchapter: (subchapter ?? null) as string,
        },
      },
      update: {
        color,
        label: label ?? null,
      },
      create: {
        userId: session.user.id,
        codeAbbr,
        chapterNum: chapterNum ?? null,
        subchapter: subchapter ?? null,
        color,
        label: label ?? null,
      },
    });

    return NextResponse.json({ marker }, { status: 201 });
  } catch (error) {
    console.error('Error creating marker:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
