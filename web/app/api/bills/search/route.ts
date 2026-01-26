import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { parseSearchQuery } from '@/lib/utils/search-parser';
import type { BillType } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const type = searchParams.get('type');
    const author = searchParams.get('author');
    const sort = searchParams.get('sort') || 'relevance';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = 20;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Bill type filter
    if (type && type !== 'all') {
      where.billType = type as BillType;
    }

    // Author filter
    if (author && author.trim()) {
      where.authors = {
        has: author.trim(),
      };
    }

    // Search query
    if (query) {
      const searchConditions = parseSearchQuery(query);
      if (searchConditions.length > 0) {
        where.AND = searchConditions;
      }
    }

    // Determine sort order
    let orderBy: any = {};
    if (sort === 'billNumber') {
      orderBy = { billNumber: 'asc' };
    } else if (sort === 'lastActionDate') {
      orderBy = { lastActionDate: 'desc' };
    } else {
      // Default: relevance (by bill number for consistency)
      orderBy = { billNumber: 'asc' };
    }

    // Fetch bills and count
    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        select: {
          id: true,
          billId: true,
          billType: true,
          billNumber: true,
          description: true,
          authors: true,
          status: true,
          lastActionDate: true,
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.bill.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      bills,
      total,
      page,
      totalPages,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
