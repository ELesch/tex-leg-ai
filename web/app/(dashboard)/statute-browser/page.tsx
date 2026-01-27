'use client';

import { useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Scale } from 'lucide-react';
import { StatuteTree, StatuteViewer } from '@/components/statute-browser';

function StatuteBrowserContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get selected section from URL
  const sectionParam = searchParams.get('section');
  const [codeAbbr, sectionNum] = sectionParam?.split('-', 2) ?? [null, null];

  // Handle section selection
  const handleSelectSection = useCallback((code: string, section: string) => {
    router.push(`/statute-browser?section=${encodeURIComponent(code)}-${encodeURIComponent(section)}`);
  }, [router]);

  const selectedSection = sectionParam;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-6 pb-4">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Scale className="h-8 w-8" />
          Statute Browser
        </h1>
        <p className="mt-1 text-muted-foreground">
          Browse Texas statutes with a tree navigation
        </p>
      </div>

      {/* Main content - Split layout */}
      <div className="flex min-h-0 flex-1 gap-3 px-6 pb-6">
        {/* Left: Tree navigation */}
        <Card className="w-80 shrink-0 flex flex-col overflow-hidden">
          <StatuteTree
            onSelectSection={handleSelectSection}
            selectedSection={selectedSection}
          />
        </Card>

        {/* Right: Statute viewer */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <StatuteViewer
            codeAbbr={codeAbbr}
            sectionNum={sectionNum}
          />
        </Card>
      </div>
    </div>
  );
}

function StatuteBrowserFallback() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-shrink-0 p-6 pb-4">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Scale className="h-8 w-8" />
          Statute Browser
        </h1>
        <p className="mt-1 text-muted-foreground">
          Browse Texas statutes with a tree navigation
        </p>
      </div>
      <div className="flex min-h-0 flex-1 gap-3 px-6 pb-6">
        <Card className="w-80 shrink-0 flex flex-col p-4">
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </Card>
        <Card className="flex-1 flex flex-col p-6">
          <Skeleton className="h-8 w-1/2 mb-4" />
          <Skeleton className="h-4 w-3/4 mb-8" />
          <Skeleton className="h-64 w-full" />
        </Card>
      </div>
    </div>
  );
}

export default function StatuteBrowserPage() {
  return (
    <Suspense fallback={<StatuteBrowserFallback />}>
      <StatuteBrowserContent />
    </Suspense>
  );
}
