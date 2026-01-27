import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ code: string; section: string }>;
}

/**
 * GET /api/statutes/[code]/sections/[section]/history - Get version history
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { code: codeAbbreviation, section: sectionNum } = await context.params;
    const abbr = codeAbbreviation.toUpperCase();

    // Get the code
    const code = await prisma.texasCode.findUnique({
      where: { abbreviation: abbr },
    });

    if (!code) {
      return NextResponse.json(
        { error: 'Code not found' },
        { status: 404 }
      );
    }

    // Get all versions of this statute
    const versions = await prisma.statute.findMany({
      where: {
        codeId: code.id,
        sectionNum,
      },
      include: {
        changedByBill: {
          select: {
            id: true,
            billId: true,
            description: true,
            status: true,
          },
        },
      },
      orderBy: {
        version: 'desc',
      },
    });

    if (versions.length === 0) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      code: {
        abbreviation: code.abbreviation,
        name: code.name,
      },
      sectionNum,
      heading: versions[0].heading,
      versions: versions.map(v => ({
        id: v.id,
        version: v.version,
        isCurrent: v.isCurrent,
        effectiveDate: v.effectiveDate,
        supersededAt: v.supersededAt,
        changeType: v.changeType,
        text: v.text,
        changedByBill: v.changedByBill,
        createdAt: v.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
