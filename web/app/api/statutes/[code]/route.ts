import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ code: string }>;
}

/**
 * GET /api/statutes/[code] - Get code details and chapters
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

    // Get distinct chapters for this code
    const chapters = await prisma.statute.groupBy({
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

    // Get bill counts affecting this code
    const billCounts = await prisma.billCodeReference.groupBy({
      by: ['chapter'],
      where: {
        code: code.name,
      },
      _count: {
        billId: true,
      },
    });

    const billCountMap = new Map(
      billCounts.map(c => [c.chapter, c._count.billId])
    );

    const chaptersWithCounts = chapters.map(ch => ({
      chapterNum: ch.chapterNum,
      chapterTitle: ch.chapterTitle,
      sectionCount: ch._count.sectionNum,
      billCount: billCountMap.get(`Chapter ${ch.chapterNum}`) ||
                 billCountMap.get(ch.chapterNum) || 0,
    }));

    return NextResponse.json({
      code: {
        id: code.id,
        abbreviation: code.abbreviation,
        name: code.name,
        sectionCount: code.sectionCount,
        lastSyncedAt: code.lastSyncedAt,
      },
      chapters: chaptersWithCounts,
    });
  } catch (error) {
    console.error('Error fetching code:', error);
    return NextResponse.json(
      { error: 'Failed to fetch code' },
      { status: 500 }
    );
  }
}
