export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

interface RouteParams {
  params: { code: string; chapter: string };
}

// GET /api/statutes/[code]/chapters/[chapter]/full - Get full chapter text (all sections concatenated)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { code, chapter } = params;
    const decodedChapter = decodeURIComponent(chapter);

    // Find the code
    const texasCode = await prisma.texasCode.findUnique({
      where: { abbreviation: code },
      select: { id: true, name: true, abbreviation: true },
    });

    if (!texasCode) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    // Get all current sections in the chapter, ordered by section number
    const sections = await prisma.statute.findMany({
      where: {
        codeId: texasCode.id,
        chapterNum: decodedChapter,
        isCurrent: true,
      },
      orderBy: [
        { subchapter: 'asc' },
        { sectionNum: 'asc' },
      ],
      select: {
        id: true,
        sectionNum: true,
        heading: true,
        text: true,
        subchapter: true,
        subchapterTitle: true,
        chapterTitle: true,
      },
    });

    if (sections.length === 0) {
      return NextResponse.json({ error: 'Chapter not found or has no sections' }, { status: 404 });
    }

    // Get the chapter title from the first section
    const chapterTitle = sections[0].chapterTitle;

    // Group sections by subchapter
    const subchapters = new Map<string | null, typeof sections>();
    for (const section of sections) {
      const key = section.subchapter;
      if (!subchapters.has(key)) {
        subchapters.set(key, []);
      }
      subchapters.get(key)!.push(section);
    }

    // Build the full chapter text with structure
    const parts: string[] = [];

    // Add chapter header
    parts.push(`CHAPTER ${decodedChapter}. ${chapterTitle || ''}\n`);
    parts.push('='.repeat(60) + '\n\n');

    // Add each subchapter
    for (const [subchapter, subchapterSections] of Array.from(subchapters.entries())) {
      if (subchapter) {
        const subchapterTitle = subchapterSections[0].subchapterTitle;
        parts.push(`SUBCHAPTER ${subchapter}. ${subchapterTitle || ''}\n`);
        parts.push('-'.repeat(40) + '\n\n');
      }

      // Add each section
      for (const section of subchapterSections) {
        parts.push(`Sec. ${section.sectionNum}. ${section.heading || ''}\n`);
        parts.push(section.text + '\n\n');
      }
    }

    const fullText = parts.join('');

    return NextResponse.json({
      code: texasCode.abbreviation,
      codeName: texasCode.name,
      chapter: decodedChapter,
      chapterTitle,
      sectionCount: sections.length,
      subchapters: Array.from(subchapters.keys()).filter(Boolean),
      fullText,
      sections: sections.map(s => ({
        id: s.id,
        sectionNum: s.sectionNum,
        heading: s.heading,
        subchapter: s.subchapter,
        textLength: s.text.length,
      })),
    });
  } catch (error) {
    console.error('Error fetching full chapter:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
