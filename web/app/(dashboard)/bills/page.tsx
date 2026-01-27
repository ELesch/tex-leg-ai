import { Suspense } from 'react';
import { BillSearch } from '@/components/bills/bill-search';
import { BillTable } from '@/components/bills/bill-table';
import { BillTableSkeleton } from '@/components/bills/bill-table-skeleton';
import { BillPagination } from '@/components/bills/bill-pagination';

interface BillsPageProps {
  searchParams: {
    search?: string;
    billType?: string;
    subject?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: string;
  };
}

export default function BillsPage({ searchParams }: BillsPageProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Fixed header */}
      <div className="flex-shrink-0 p-6 pb-0">
        <h1 className="text-3xl font-bold">Browse Bills</h1>
        <p className="mt-1 text-muted-foreground">
          Search and explore bills from the 89th Texas Legislature
        </p>
      </div>

      {/* Fixed search */}
      <div className="flex-shrink-0 p-6 pb-4">
        <Suspense fallback={<div className="h-20 animate-pulse rounded-lg bg-muted" />}>
          <BillSearch />
        </Suspense>
      </div>

      {/* Scrollable table */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6">
        <Suspense fallback={<BillTableSkeleton />}>
          <BillTable searchParams={searchParams} />
        </Suspense>
      </div>

      {/* Fixed pagination */}
      <div className="flex-shrink-0 border-t bg-background p-4">
        <Suspense fallback={<div className="h-10 animate-pulse rounded bg-muted" />}>
          <BillPagination searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
