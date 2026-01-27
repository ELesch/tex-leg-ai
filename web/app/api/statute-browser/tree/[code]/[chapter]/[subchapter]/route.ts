import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ code: string; chapter: string; subchapter: string }>;
}

/**
 * GET /api/statute-browser/tree/[code]/[chapter]/[subchapter] - Get sections for a subchapter
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { code: codeAbbreviation, chapter: chapterNum, subchapter } = await context.params;
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

    // Get sections for this subchapter
    const sections = await prisma.statute.findMany({
      where: {
        codeId: code.id,
        chapterNum,
        subchapter,
        isCurrent: true,
      },
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
      subchapter,
      sections: sections.map(s => ({
        id: s.id,
        sectionNum: s.sectionNum,
        heading: s.heading,
      })),
    });
  } catch (error) {
    console.error('Error fetching subchapter sections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subchapter sections' },
      { status: 500 }
    );
  }
}
