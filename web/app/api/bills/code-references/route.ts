export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/bills/code-references?code=ED&section=29.001&chapter=29&subchapter=A
// Returns bills that reference/affect the given statute
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const codeParam = searchParams.get('code');
    const section = searchParams.get('section');
    const chapter = searchParams.get('chapter');
    const subchapter = searchParams.get('subchapter');

    if (!codeParam) {
      return NextResponse.json(
        { error: 'code parameter is required' },
        { status: 400 }
      );
    }

    // Look up code by abbreviation or name
    const codeRecord = await prisma.texasCode.findFirst({
      where: {
        OR: [
          { abbreviation: codeParam.toUpperCase() },
          { name: { contains: codeParam, mode: 'insensitive' } },
        ],
      },
    });

    // Build code name variations to search for
    const codeVariations: string[] = [codeParam];
    if (codeRecord) {
      if (codeRecord.name) codeVariations.push(codeRecord.name);
      if (codeRecord.abbreviation) codeVariations.push(codeRecord.abbreviation);
    }
    // Also try common variations
    if (codeParam.toUpperCase() !== codeParam) {
      codeVariations.push(codeParam.toUpperCase());
    }

    // Build section variations (with and without "Section" prefix)
    const sectionVariations: string[] = [];
    if (section) {
      sectionVariations.push(section);
      if (!section.toLowerCase().startsWith('section')) {
        sectionVariations.push(`Section ${section}`);
      }
      // Handle cases like "29.001" vs "29.001(a)"
      const baseSectionMatch = section.match(/^[\d.]+/);
      if (baseSectionMatch && baseSectionMatch[0] !== section) {
        sectionVariations.push(baseSectionMatch[0]);
        sectionVariations.push(`Section ${baseSectionMatch[0]}`);
      }
    }

    // Build subchapter variations
    const subchapterVariations: string[] = [];
    if (subchapter) {
      subchapterVariations.push(subchapter);
      subchapterVariations.push(`Subchapter ${subchapter}`);
      subchapterVariations.push(`Subch. ${subchapter}`);
    }

    // Query BillCodeReference with code name variations
    const references = await prisma.billCodeReference.findMany({
      where: {
        code: { in: codeVariations, mode: 'insensitive' },
        ...(sectionVariations.length > 0 && {
          section: { in: sectionVariations, mode: 'insensitive' },
        }),
        ...(chapter && {
          OR: [
            { chapter: chapter },
            { chapter: `Chapter ${chapter}` },
            { chapter: { startsWith: chapter } },
          ],
        }),
        ...(subchapterVariations.length > 0 && {
          subchapter: { in: subchapterVariations, mode: 'insensitive' },
        }),
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
        { bill: { lastActionDate: 'desc' } },
      ],
    });

    // Deduplicate by billId (same bill may have multiple references)
    const seenBillIds = new Set<string>();
    const uniqueReferences = references.filter(ref => {
      if (seenBillIds.has(ref.bill.billId)) {
        return false;
      }
      seenBillIds.add(ref.bill.billId);
      return true;
    });

    return NextResponse.json({
      references: uniqueReferences.map(ref => ({
        id: ref.id,
        billId: ref.bill.billId,
        action: ref.action,
        section: ref.section,
        code: ref.code,
        description: ref.bill.description,
        bill: ref.bill,
      })),
    });
  } catch (error) {
    console.error('Error fetching code references:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
