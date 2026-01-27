import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/statute-browser/tree - Get top-level codes for tree navigation
 */
export async function GET() {
  try {
    const codes = await prisma.texasCode.findMany({
      orderBy: { abbreviation: 'asc' },
      select: {
        id: true,
        abbreviation: true,
        name: true,
        sectionCount: true,
      },
    });

    // Check actual statute counts for each code (more accurate than cached sectionCount)
    const statuteCounts = await prisma.statute.groupBy({
      by: ['codeId'],
      where: { isCurrent: true },
      _count: { id: true },
    });

    const countMap = new Map(statuteCounts.map(s => [s.codeId, s._count.id]));

    return NextResponse.json({
      codes: codes.map(code => {
        const actualCount = countMap.get(code.id) || 0;
        return {
          id: code.id,
          abbreviation: code.abbreviation,
          name: code.name,
          sectionCount: actualCount,
          hasChildren: actualCount > 0,
        };
      }),
    });
  } catch (error) {
    console.error('Error fetching codes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch codes' },
      { status: 500 }
    );
  }
}
