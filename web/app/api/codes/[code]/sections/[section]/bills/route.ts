export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

interface RouteParams {
  params: { code: string; section: string };
}

// GET /api/codes/[code]/sections/[section]/bills - Get bills affecting a specific section
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Decode URL parameters
    const code = decodeURIComponent(params.code);
    const section = decodeURIComponent(params.section);

    // Get all code references for this section
    const references = await prisma.billCodeReference.findMany({
      where: {
        code,
        section,
      },
      include: {
        bill: {
          select: {
            id: true,
            billId: true,
            billType: true,
            billNumber: true,
            description: true,
            status: true,
            authors: true,
            lastAction: true,
            lastActionDate: true,
          },
        },
      },
      orderBy: [
        { action: 'asc' },
        { bill: { billNumber: 'asc' } },
      ],
    });

    // Group by action type
    const groupedByAction: Record<string, typeof references> = {
      ADD: [],
      AMEND: [],
      REPEAL: [],
    };

    for (const ref of references) {
      groupedByAction[ref.action].push(ref);
    }

    // Get unique bills
    const uniqueBillIds = new Set(references.map(r => r.billId));

    return NextResponse.json({
      code,
      section,
      references,
      groupedByAction,
      totalReferences: references.length,
      uniqueBillCount: uniqueBillIds.size,
    });
  } catch (error) {
    console.error('Error fetching bills for section:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
