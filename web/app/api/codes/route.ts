export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/codes - List all Texas codes with bill counts
export async function GET(request: NextRequest) {
  try {
    // Get unique codes with bill counts
    const codeStats = await prisma.billCodeReference.groupBy({
      by: ['code'],
      _count: {
        code: true,
      },
      orderBy: {
        _count: {
          code: 'desc',
        },
      },
    });

    // Get unique bill count per code
    const codesWithBillCounts = await Promise.all(
      codeStats.map(async (stat) => {
        const billCount = await prisma.billCodeReference.groupBy({
          by: ['billId'],
          where: { code: stat.code },
        });
        return {
          code: stat.code,
          referenceCount: stat._count.code,
          billCount: billCount.length,
        };
      })
    );

    return NextResponse.json({
      codes: codesWithBillCounts,
      totalCodes: codesWithBillCounts.length,
    });
  } catch (error) {
    console.error('Error fetching codes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
