import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { Pagination } from './pagination';
import { parseSearchQuery } from '@/lib/utils/search-parser';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { BillType } from '@/types';
import { AuthorLink } from '@/components/bills/author-link';

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
        authors: true,
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

      {/* Bill table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Type</TableHead>
              <TableHead className="w-[100px]">Number</TableHead>
              <TableHead className="hidden w-[200px] md:table-cell">Author</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.map((bill) => (
              <TableRow key={bill.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <Link href={`/bills/${bill.billId.replace(' ', '-')}`} className="block">
                    <Badge variant={bill.billType === 'HB' ? 'hb' : 'sb'}>
                      {bill.billType}
                    </Badge>
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/bills/${bill.billId.replace(' ', '-')}`} className="block font-medium">
                    {bill.billNumber}
                  </Link>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {bill.authors.length > 0 ? (
                    <AuthorLink name={bill.authors[0]} className="text-sm" />
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                  {bill.authors.length > 1 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      +{bill.authors.length - 1}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Link href={`/bills/${bill.billId.replace(' ', '-')}`} className="block">
                    <span className="line-clamp-2 text-muted-foreground">{bill.description}</span>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <Pagination currentPage={page} totalPages={totalPages} />
    </div>
  );
}
