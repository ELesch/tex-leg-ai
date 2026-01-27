import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ code: string; chapter: string }>;
}

/**
 * GET /api/statute-browser/tree/[code]/[chapter] - Get subchapters and sections for a chapter
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

    // Get distinct subchapters for this chapter
    const subchaptersData = await prisma.statute.groupBy({
      by: ['subchapter', 'subchapterTitle'],
      where: {
        codeId: code.id,
        chapterNum,
        isCurrent: true,
        subchapter: { not: null },
      },
      _count: {
        sectionNum: true,
      },
      orderBy: {
        subchapter: 'asc',
      },
    });

    const subchapters = subchaptersData.map(sc => ({
      subchapter: sc.subchapter,
      subchapterTitle: sc.subchapterTitle,
      sectionCount: sc._count.sectionNum,
    }));

    // Get sections for this chapter (only those without subchapters, or all if no subchapters)
    const sectionsQuery: {
      codeId: string;
      chapterNum: string;
      isCurrent: boolean;
      subchapter?: null;
    } = {
      codeId: code.id,
      chapterNum,
      isCurrent: true,
    };

    // If there are subchapters, only get sections without a subchapter here
    if (subchapters.length > 0) {
      sectionsQuery.subchapter = null;
    }

    const sections = await prisma.statute.findMany({
      where: sectionsQuery,
      select: {
        id: true,
        sectionNum: true,
        heading: true,
      },
      orderBy: {
        sectionNum: 'asc',
      },
    });

    return NextResponse.json({
      code: {
        abbreviation: code.abbreviation,
        name: code.name,
      },
      chapter: {
        chapterNum,
      },
      subchapters,
      sections: sections.map(s => ({
        id: s.id,
        sectionNum: s.sectionNum,
        heading: s.heading,
      })),
    });
  } catch (error) {
    console.error('Error fetching chapter contents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chapter contents' },
      { status: 500 }
    );
  }
}
