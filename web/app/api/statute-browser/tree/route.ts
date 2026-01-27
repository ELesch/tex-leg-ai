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

    return NextResponse.json({
      codes: codes.map(code => ({
        id: code.id,
        abbreviation: code.abbreviation,
        name: code.name,
        sectionCount: code.sectionCount,
        hasChildren: code.sectionCount > 0,
      })),
    });
  } catch (error) {
    console.error('Error fetching codes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch codes' },
      { status: 500 }
    );
  }
}
