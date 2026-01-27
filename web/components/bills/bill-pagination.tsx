import { prisma } from '@/lib/db/prisma';
import { parseSearchQuery } from '@/lib/utils/search-parser';
import { Pagination } from './pagination';
import type { BillType } from '@/types';

interface BillPaginationProps {
  searchParams: {
    search?: string;
    billType?: string;
    subject?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: string;
  };
}

export async function BillPagination({ searchParams }: BillPaginationProps) {
  const page = parseInt(searchParams.page || '1');
  const limit = 20;

  // Build where clause (same as BillTable)
  const where: Record<string, unknown> = {};

  if (searchParams.billType && searchParams.billType !== 'all') {
    where.billType = searchParams.billType as BillType;
  }

  if (searchParams.subject) {
    where.subjects = { has: searchParams.subject };
  }

  if (searchParams.search) {
    const searchConditions = parseSearchQuery(searchParams.search);
    if (searchConditions.length > 0) {
      where.AND = searchConditions;
    }
  }

  const total = await prisma.bill.count({ where });
  const totalPages = Math.ceil(total / limit);

  if (totalPages <= 1) {
    return null;
  }

  return <Pagination currentPage={page} totalPages={totalPages} />;
}
