import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/statutes - List all Texas codes with section counts
 */
export async function GET() {
  try {
    const codes = await prisma.texasCode.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        abbreviation: true,
        name: true,
        sectionCount: true,
        lastSyncedAt: true,
      },
    });

    // Also get bill reference counts for each code
    const codeBillCounts = await prisma.billCodeReference.groupBy({
      by: ['code'],
      _count: {
        billId: true,
      },
    });

    const billCountMap = new Map(
      codeBillCounts.map(c => [c.code, c._count.billId])
    );

    const codesWithBillCounts = codes.map(code => ({
      ...code,
      billReferenceCount: billCountMap.get(code.name) || 0,
    }));

    return NextResponse.json({
      codes: codesWithBillCounts,
    });
  } catch (error) {
    console.error('Error fetching codes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch codes' },
      { status: 500 }
    );
  }
}
