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

    if (!codeAbbr || !chapterNum) {
      return NextResponse.json({ error: 'Code and chapter required' }, { status: 400 });
    }

    // Map code abbreviation to full code name pattern
    const codeNamePatterns: Record<string, string> = {
      'ED': 'Education Code',
      'GV': 'Government Code',
      'BC': 'Business and Commerce Code',
      'CP': 'Civil Practice and Remedies Code',
      'CR': 'Code of Criminal Procedure',
      'EL': 'Election Code',
      'FA': 'Family Code',
      'FI': 'Finance Code',
      'HS': 'Health and Safety Code',
      'HR': 'Human Resources Code',
      'IN': 'Insurance Code',
      'LA': 'Labor Code',
      'LG': 'Local Government Code',
      'NR': 'Natural Resources Code',
      'OC': 'Occupations Code',
      'PE': 'Penal Code',
      'PW': 'Parks and Wildlife Code',
      'PR': 'Property Code',
      'TX': 'Tax Code',
      'TN': 'Transportation Code',
      'UT': 'Utilities Code',
      'WA': 'Water Code',
    };

    const codeName = codeNamePatterns[codeAbbr] || codeAbbr;

    // Find bills with code references to this chapter
    const codeReferences = await prisma.billCodeReference.findMany({
      where: {
        OR: [
          { code: { contains: codeName } },
          { code: { contains: codeAbbr } },
        ],
        chapter: { contains: chapterNum },
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
      distinct: ['billId'],
      take: 50,
    });

    // Deduplicate and format bills
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
