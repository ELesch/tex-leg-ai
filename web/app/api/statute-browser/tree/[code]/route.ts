import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ code: string }>;
}

/**
 * GET /api/statute-browser/tree/[code] - Get chapters for a code
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { code: codeAbbreviation } = await context.params;
    const abbr = codeAbbreviation.toUpperCase();

    // Get the code
    const code = await prisma.texasCode.findUnique({
      where: { abbreviation: abbr },
    });

    if (!code) {
      return NextResponse.json(
        { error: 'Code not found' },
        { status: 404 }
      );
    }

    // Get distinct chapters for this code with subchapter info
    const chaptersWithSubchapters = await prisma.statute.groupBy({
      by: ['chapterNum', 'chapterTitle'],
      where: {
        codeId: code.id,
        isCurrent: true,
      },
      _count: {
        sectionNum: true,
      },
      orderBy: {
        chapterNum: 'asc',
      },
    });

    // Check which chapters have subchapters
    const subchapterCounts = await prisma.statute.groupBy({
      by: ['chapterNum'],
      where: {
        codeId: code.id,
        isCurrent: true,
        subchapter: { not: null },
      },
      _count: {
        subchapter: true,
      },
    });

    const subchapterMap = new Map(
      subchapterCounts.map(s => [s.chapterNum, s._count.subchapter])
    );

    const chapters = chaptersWithSubchapters.map(ch => ({
      chapterNum: ch.chapterNum,
      chapterTitle: ch.chapterTitle,
      sectionCount: ch._count.sectionNum,
      hasSubchapters: (subchapterMap.get(ch.chapterNum) || 0) > 0,
    }));

    return NextResponse.json({
      code: {
        id: code.id,
        abbreviation: code.abbreviation,
        name: code.name,
      },
      chapters,
    });
  } catch (error) {
    console.error('Error fetching chapters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chapters' },
      { status: 500 }
    );
  }
}
