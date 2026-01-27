export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

interface RouteParams {
  params: { code: string; chapter: string; subchapter: string };
}

// GET /api/statutes/[code]/chapters/[chapter]/subchapters/[subchapter] - Get subchapter sections
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { code, chapter, subchapter } = params;
    const decodedChapter = decodeURIComponent(chapter);
    const decodedSubchapter = decodeURIComponent(subchapter);

    // Find the code
    const texasCode = await prisma.texasCode.findUnique({
      where: { abbreviation: code },
      select: { id: true, name: true, abbreviation: true },
    });

    if (!texasCode) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    // Get all current sections in the subchapter, ordered by section number
    const sections = await prisma.statute.findMany({
      where: {
        codeId: texasCode.id,
        chapterNum: decodedChapter,
        subchapter: decodedSubchapter,
        isCurrent: true,
      },
      orderBy: [
        { sectionNum: 'asc' },
      ],
      select: {
        id: true,
        sectionNum: true,
        heading: true,
        text: true,
        chapterTitle: true,
        subchapterTitle: true,
      },
    });

    if (sections.length === 0) {
      return NextResponse.json({ error: 'Subchapter not found or has no sections' }, { status: 404 });
    }

    // Get the chapter and subchapter titles from the first section
    const chapterTitle = sections[0].chapterTitle;
    const subchapterTitle = sections[0].subchapterTitle;

    return NextResponse.json({
      code: texasCode.abbreviation,
      codeName: texasCode.name,
      chapter: decodedChapter,
      chapterTitle,
      subchapter: decodedSubchapter,
      subchapterTitle,
      sectionCount: sections.length,
      sections: sections.map(s => ({
        id: s.id,
        sectionNum: s.sectionNum,
        heading: s.heading,
        text: s.text,
        textLength: s.text.length,
      })),
    });
  } catch (error) {
    console.error('Error fetching subchapter:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
