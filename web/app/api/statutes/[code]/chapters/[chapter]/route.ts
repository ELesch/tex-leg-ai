import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ code: string; chapter: string }>;
}

/**
 * GET /api/statutes/[code]/chapters/[chapter] - Get sections in a chapter
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { code: codeAbbreviation, chapter: chapterNum } = await context.params;
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

    // Get sections for this chapter
    const sections = await prisma.statute.findMany({
      where: {
        codeId: code.id,
        chapterNum,
        isCurrent: true,
      },
      select: {
        id: true,
        sectionNum: true,
        heading: true,
        subchapter: true,
        subchapterTitle: true,
        // Don't include full text to keep response small
      },
      orderBy: {
        sectionNum: 'asc',
      },
    });

    // Get bill counts for each section
    const sectionBillCounts = await prisma.billCodeReference.groupBy({
      by: ['section'],
      where: {
        code: code.name,
        chapter: { in: [`Chapter ${chapterNum}`, chapterNum] },
      },
      _count: {
        billId: true,
      },
    });

    const billCountMap = new Map(
      sectionBillCounts.map(s => [s.section, s._count.billId])
    );

    // Get chapter title from first section
    const chapterTitle = sections[0]?.subchapterTitle || null;

    const sectionsWithCounts = sections.map(s => ({
      ...s,
      billCount: billCountMap.get(s.sectionNum) ||
                 billCountMap.get(`Section ${s.sectionNum}`) || 0,
    }));

    return NextResponse.json({
      code: {
        abbreviation: code.abbreviation,
        name: code.name,
      },
      chapter: {
        chapterNum,
        chapterTitle,
        sectionCount: sections.length,
      },
      sections: sectionsWithCounts,
    });
  } catch (error) {
    console.error('Error fetching chapter:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chapter' },
      { status: 500 }
    );
  }
}
