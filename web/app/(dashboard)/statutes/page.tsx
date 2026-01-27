'use client';

import { Suspense } from 'react';
import { Scale } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatuteWorkspaceLayout } from '@/components/statute-browser';

function StatutesPageFallback() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-shrink-0 p-6 pb-4">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Scale className="h-8 w-8" />
          Texas Statutes
        </h1>
        <p className="mt-1 text-muted-foreground">
          Browse Texas statutes with search, markers, and notes
        </p>
      </div>
      <div className="flex-1 p-6 pt-0">
        <Skeleton className="h-full w-full" />
      </div>
    </div>
  );
}

export default function StatutesPage() {
  return (
    <Suspense fallback={<StatutesPageFallback />}>
      <StatuteWorkspaceLayout />
    </Suspense>
  );
}
