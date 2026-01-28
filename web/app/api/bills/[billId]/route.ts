import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// GET /api/bills/[billId] - Get bill details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ billId: string }> }
) {
  try {
    const { billId } = await params;

    const bill = await prisma.bill.findFirst({
      where: {
        billId: { equals: billId, mode: 'insensitive' },
      },
      select: {
        id: true,
        billId: true,
        description: true,
        content: true,
        status: true,
        authors: true,
        lastAction: true,
        lastActionDate: true,
      },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    return NextResponse.json({ bill });
  } catch (error) {
    console.error('Error fetching bill:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
