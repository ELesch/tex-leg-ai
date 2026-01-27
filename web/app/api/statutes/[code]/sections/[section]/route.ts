import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ code: string; section: string }>;
}

/**
 * GET /api/statutes/[code]/sections/[section] - Get full statute with affecting bills
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

    // Get the current version of the statute
    const statute = await prisma.statute.findFirst({
      where: {
        codeId: code.id,
        sectionNum,
        isCurrent: true,
      },
      include: {
        changedByBill: {
          select: {
            id: true,
            billId: true,
            description: true,
            status: true,
            lastActionDate: true,
          },
        },
      },
    });

    if (!statute) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      );
    }

    // Get bills that reference this section
    const affectingBills = await prisma.billCodeReference.findMany({
      where: {
        code: code.name,
        section: { in: [sectionNum, `Section ${sectionNum}`, sectionNum.replace(/^(\d+\.\d+).*/, '$1')] },
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
      orderBy: {
        bill: {
          lastActionDate: 'desc',
        },
      },
    });

    // Get version count for history link
    const versionCount = await prisma.statute.count({
      where: {
        codeId: code.id,
        sectionNum,
      },
    });

    return NextResponse.json({
      code: {
        abbreviation: code.abbreviation,
        name: code.name,
      },
      statute: {
        id: statute.id,
        sectionNum: statute.sectionNum,
        heading: statute.heading,
        text: statute.text,
        textHtml: statute.textHtml,
        chapterNum: statute.chapterNum,
        chapterTitle: statute.chapterTitle,
        subchapter: statute.subchapter,
        subchapterTitle: statute.subchapterTitle,
        version: statute.version,
        effectiveDate: statute.effectiveDate,
        sourceUrl: statute.sourceUrl,
        changedByBill: statute.changedByBill,
        changeType: statute.changeType,
      },
      affectingBills: affectingBills.map(ref => ({
        id: ref.id,
        action: ref.action,
        billSection: ref.billSection,
        bill: ref.bill,
      })),
      versionCount,
    });
  } catch (error) {
    console.error('Error fetching section:', error);
    return NextResponse.json(
      { error: 'Failed to fetch section' },
      { status: 500 }
    );
  }
}
