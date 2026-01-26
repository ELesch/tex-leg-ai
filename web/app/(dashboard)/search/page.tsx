import { Suspense } from 'react';
import { SearchContent } from './search-content';
import { Loader2 } from 'lucide-react';

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Advanced Search</h1>
            <p className="mt-1 text-muted-foreground">
              Search bills with advanced filters and boolean operators
            </p>
          </div>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
