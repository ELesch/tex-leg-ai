import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// GET - Get bills affecting a chapter/subchapter
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const codeAbbr = searchParams.get('codeAbbr');
    const chapterNum = searchParams.get('chapterNum');
    const subchapter = searchParams.get('subchapter');

    if (!codeAbbr || !chapterNum) {
      return NextResponse.json({ error: 'Code and chapter required' }, { status: 400 });
    }

    // Look up code by abbreviation to get full name
    const codeRecord = await prisma.texasCode.findFirst({
      where: {
        OR: [
          { abbreviation: codeAbbr.toUpperCase() },
          { name: { contains: codeAbbr, mode: 'insensitive' } },
        ],
      },
    });

    // Build code name variations to search for
    const codeVariations: string[] = [codeAbbr, codeAbbr.toUpperCase()];
    if (codeRecord) {
      if (codeRecord.name) codeVariations.push(codeRecord.name);
      if (codeRecord.abbreviation) codeVariations.push(codeRecord.abbreviation);
    }

    // Build chapter variations
    const chapterVariations = [
      chapterNum,
      `Chapter ${chapterNum}`,
      `Ch. ${chapterNum}`,
    ];

    // Build subchapter variations if provided
    const subchapterVariations: string[] = [];
    if (subchapter) {
      subchapterVariations.push(subchapter);
      subchapterVariations.push(`Subchapter ${subchapter}`);
      subchapterVariations.push(`Subch. ${subchapter}`);
    }

    // Find bills with code references to this chapter/subchapter
    const codeReferences = await prisma.billCodeReference.findMany({
      where: {
        code: { in: codeVariations, mode: 'insensitive' },
        OR: chapterVariations.map(ch => ({
          chapter: { contains: ch, mode: 'insensitive' },
        })),
        ...(subchapterVariations.length > 0 && {
          subchapter: { in: subchapterVariations, mode: 'insensitive' },
        }),
      },
      include: {
        bill: {
          select: {
            id: true,
            billId: true,
            description: true,
            status: true,
            authors: true,
          },
        },
      },
      take: 100,
    });

    // Deduplicate by bill id
    const billsMap = new Map<string, {
      id: string;
      billId: string;
      description: string;
      status: string | null;
      authors: string[];
      action: string;
    }>();

    for (const ref of codeReferences) {
      if (!billsMap.has(ref.bill.id)) {
        billsMap.set(ref.bill.id, {
          id: ref.bill.id,
          billId: ref.bill.billId,
          description: ref.bill.description,
          status: ref.bill.status,
          authors: ref.bill.authors,
          action: ref.action,
        });
      }
    }

    const bills = Array.from(billsMap.values()).sort((a, b) =>
      a.billId.localeCompare(b.billId)
    );

    return NextResponse.json({ bills });
  } catch (error) {
    console.error('Error fetching affecting bills:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
