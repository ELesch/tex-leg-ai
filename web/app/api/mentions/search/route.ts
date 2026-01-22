import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// Mention types
type MentionType = 'bill' | 'author' | 'contact' | 'all';

interface MentionResult {
  type: 'bill' | 'author' | 'contact';
  id: string;
  displayText: string;
  subtext?: string;
}

// GET /api/mentions/search - Unified search for @-mentions
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const type = (searchParams.get('type') || 'all') as MentionType;
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (query.length < 1) {
      return NextResponse.json({ mentions: [] });
    }

    const results: MentionResult[] = [];

    // Search bills
    if (type === 'all' || type === 'bill') {
      const bills = await prisma.bill.findMany({
        where: {
          OR: [
            { billId: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          billId: true,
          description: true,
          session: {
            select: { code: true },
          },
        },
        take: Math.min(limit, 20),
        orderBy: { updatedAt: 'desc' },
      });

      for (const bill of bills) {
        results.push({
          type: 'bill',
          id: bill.id,
          displayText: bill.billId,
          subtext: bill.description.length > 60
            ? bill.description.substring(0, 60) + '...'
            : bill.description,
        });
      }
    }

    // Search authors
    if (type === 'all' || type === 'author') {
      const authors = await prisma.author.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { displayName: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          displayName: true,
          chamber: true,
          district: true,
          party: true,
        },
        take: Math.min(limit, 20),
        orderBy: { name: 'asc' },
      });

      for (const author of authors) {
        const chamberLabel = author.chamber === 'HOUSE' ? 'Rep.' : author.chamber === 'SENATE' ? 'Sen.' : '';
        const districtLabel = author.district ? `District ${author.district}` : '';
        const partyLabel = author.party ? `(${author.party})` : '';
        const subtext = [chamberLabel, districtLabel, partyLabel].filter(Boolean).join(' ');

        results.push({
          type: 'author',
          id: author.id,
          displayText: author.displayName || author.name,
          subtext: subtext || undefined,
        });
      }
    }

    // Search user's contacts
    if (type === 'all' || type === 'contact') {
      const contacts = await prisma.contact.findMany({
        where: {
          userId: session.user.id,
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { displayName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { organization: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          title: true,
          organization: true,
        },
        take: Math.min(limit, 20),
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });

      for (const contact of contacts) {
        const fullName = contact.displayName || `${contact.firstName} ${contact.lastName}`;
        const subtextParts = [];
        if (contact.title) subtextParts.push(contact.title);
        if (contact.organization) subtextParts.push(contact.organization);

        results.push({
          type: 'contact',
          id: contact.id,
          displayText: fullName,
          subtext: subtextParts.length > 0 ? subtextParts.join(', ') : undefined,
        });
      }
    }

    // Sort results by relevance (exact matches first)
    const lowerQuery = query.toLowerCase();
    results.sort((a, b) => {
      const aExact = a.displayText.toLowerCase().startsWith(lowerQuery) ? 0 : 1;
      const bExact = b.displayText.toLowerCase().startsWith(lowerQuery) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      return a.displayText.localeCompare(b.displayText);
    });

    return NextResponse.json({
      mentions: results.slice(0, Math.min(limit, 20)),
    });
  } catch (error) {
    console.error('Error searching mentions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
