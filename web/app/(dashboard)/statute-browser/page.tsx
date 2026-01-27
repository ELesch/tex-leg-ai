'use client';

import { Suspense } from 'react';
import { Scale } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatuteWorkspaceLayout } from '@/components/statute-browser';

function StatuteBrowserFallback() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-shrink-0 p-6 pb-4">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Scale className="h-8 w-8" />
          Statute Browser
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

export default function StatuteBrowserPage() {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-6 pb-4">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Scale className="h-8 w-8" />
          Statute Browser
        </h1>
        <p className="mt-1 text-muted-foreground">
          Browse Texas statutes with search, markers, and notes
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 px-6 pb-6">
        <Suspense fallback={<Skeleton className="h-full w-full" />}>
          <StatuteWorkspaceLayout className="h-full border rounded-lg overflow-hidden" />
        </Suspense>
      </div>
    </div>
  );
}
