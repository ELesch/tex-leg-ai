export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

interface RouteParams {
  params: { code: string };
}

// GET /api/codes/[code]/chapters - List chapters for a Texas code with bill counts
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const code = decodeURIComponent(params.code);

    // Get chapters grouped with counts
    const chapterStats = await prisma.billCodeReference.groupBy({
      by: ['chapter'],
      where: { code },
      _count: {
        chapter: true,
      },
      orderBy: {
        chapter: 'asc',
      },
    });

    // Get unique bill count per chapter
    const chaptersWithBillCounts = await Promise.all(
      chapterStats.map(async (stat) => {
        const billCount = await prisma.billCodeReference.groupBy({
          by: ['billId'],
          where: {
            code,
            chapter: stat.chapter,
          },
        });

        // Get section count for this chapter
        const sectionCount = await prisma.billCodeReference.groupBy({
          by: ['section'],
          where: {
            code,
            chapter: stat.chapter,
          },
        });

        return {
          chapter: stat.chapter || 'Other',
          referenceCount: stat._count.chapter,
          billCount: billCount.length,
          sectionCount: sectionCount.length,
        };
      })
    );

    return NextResponse.json({
      code,
      chapters: chaptersWithBillCounts,
      totalChapters: chaptersWithBillCounts.length,
    });
  } catch (error) {
    console.error('Error fetching chapters:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
