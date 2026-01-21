import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { BillCard } from './bill-card';
import { Pagination } from './pagination';
import { parseSearchQuery } from '@/lib/utils/search-parser';
import type { BillType } from '@/types';

interface BillListProps {
  searchParams: {
    search?: string;
    billType?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: string;
  };
}

export async function BillList({ searchParams }: BillListProps) {
  const page = parseInt(searchParams.page || '1');
  const limit = 20;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = {};

  // Bill type filter
  if (searchParams.billType && searchParams.billType !== 'all') {
    where.billType = searchParams.billType as BillType;
  }

  // Search filter
  if (searchParams.search) {
    const searchConditions = parseSearchQuery(searchParams.search);
    if (searchConditions.length > 0) {
      where.AND = searchConditions;
    }
  }

  // Determine sort
  const sortBy = searchParams.sortBy || 'billNumber';
  const sortOrder = (searchParams.sortOrder || 'asc') as 'asc' | 'desc';

  const orderBy: any = {};
  if (sortBy === 'billNumber') {
    orderBy.billNumber = sortOrder;
  } else if (sortBy === 'description') {
    orderBy.description = sortOrder;
  } else if (sortBy === 'lastActionDate') {
    orderBy.lastActionDate = sortOrder;
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
        status: true,
        lastAction: true,
        lastActionDate: true,
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.bill.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  if (bills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
        <p className="text-lg font-medium text-muted-foreground">
          No bills found
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try adjusting your search or filters
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {skip + 1}-{Math.min(skip + limit, total)} of{' '}
          {total.toLocaleString()} bills
        </p>
      </div>

      {/* Bill grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {bills.map((bill) => (
          <Link key={bill.id} href={`/bills/${bill.billId.replace(' ', '-')}`}>
            <BillCard bill={{
              ...bill,
              lastActionDate: bill.lastActionDate?.toISOString() ?? null,
            }} />
          </Link>
        ))}
      </div>

      {/* Pagination */}
      <Pagination currentPage={page} totalPages={totalPages} />
    </div>
  );
}
