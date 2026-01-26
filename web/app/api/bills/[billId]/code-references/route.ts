export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

interface RouteParams {
  params: { billId: string };
}

// GET /api/bills/[billId]/code-references - Get code references for a bill
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { billId } = params;

    // Find the bill by billId
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { id: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Get code references for this bill
    const references = await prisma.billCodeReference.findMany({
      where: { billId: bill.id },
      orderBy: [
        { code: 'asc' },
        { section: 'asc' },
      ],
    });

    // Group by code for better organization
    const groupedByCode: Record<string, typeof references> = {};
    for (const ref of references) {
      if (!groupedByCode[ref.code]) {
        groupedByCode[ref.code] = [];
      }
      groupedByCode[ref.code].push(ref);
    }

    return NextResponse.json({
      references,
      groupedByCode,
      totalCount: references.length,
    });
  } catch (error) {
    console.error('Error fetching code references:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
