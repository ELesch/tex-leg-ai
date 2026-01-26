export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

interface RouteParams {
  params: { code: string };
}

// GET /api/codes/[code]/sections - List sections for a Texas code with bill counts
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Decode the code name (URLs encode spaces, etc.)
    const code = decodeURIComponent(params.code);

    // Get sections grouped with bill counts
    const sectionStats = await prisma.billCodeReference.groupBy({
      by: ['section', 'chapter'],
      where: { code },
      _count: {
        section: true,
      },
      orderBy: [
        { chapter: 'asc' },
        { section: 'asc' },
      ],
    });

    // Get unique bill count per section
    const sectionsWithBillCounts = await Promise.all(
      sectionStats.map(async (stat) => {
        const billCount = await prisma.billCodeReference.groupBy({
          by: ['billId'],
          where: {
            code,
            section: stat.section,
          },
        });
        return {
          section: stat.section,
          chapter: stat.chapter,
          referenceCount: stat._count.section,
          billCount: billCount.length,
        };
      })
    );

    // Group by chapter
    const groupedByChapter: Record<string, typeof sectionsWithBillCounts> = {};
    for (const section of sectionsWithBillCounts) {
      const chapterKey = section.chapter || 'Other';
      if (!groupedByChapter[chapterKey]) {
        groupedByChapter[chapterKey] = [];
      }
      groupedByChapter[chapterKey].push(section);
    }

    return NextResponse.json({
      code,
      sections: sectionsWithBillCounts,
      groupedByChapter,
      totalSections: sectionsWithBillCounts.length,
    });
  } catch (error) {
    console.error('Error fetching sections:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
