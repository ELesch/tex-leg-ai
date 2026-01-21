import { Suspense } from 'react';
import { BillSearch } from '@/components/bills/bill-search';
import { BillList } from '@/components/bills/bill-list';
import { BillListSkeleton } from '@/components/bills/bill-list-skeleton';

interface BillsPageProps {
  searchParams: {
    search?: string;
    billType?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: string;
  };
}

export default function BillsPage({ searchParams }: BillsPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Browse Bills</h1>
        <p className="mt-1 text-muted-foreground">
          Search and explore bills from the 89th Texas Legislature
        </p>
      </div>

      <Suspense fallback={<div className="h-20 animate-pulse rounded-lg bg-muted" />}>
        <BillSearch />
      </Suspense>

      <Suspense fallback={<BillListSkeleton />}>
        <BillList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
