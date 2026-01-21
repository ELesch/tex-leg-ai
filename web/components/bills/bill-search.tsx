'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

export function BillSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');

  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '' || value === 'all') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      // Reset to page 1 when filters change
      if (!updates.hasOwnProperty('page')) {
        params.set('page', '1');
      }

      router.push(`/bills?${params.toString()}`);
    },
    [router, searchParams]
  );

  const debouncedSearch = useDebouncedCallback((value: string) => {
    updateSearchParams({ search: value || null });
  }, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    debouncedSearch(value);
  };

  const clearSearch = () => {
    setSearch('');
    updateSearchParams({ search: null });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search bills by keyword, bill number, or description..."
            value={search}
            onChange={handleSearchChange}
            className="pl-9 pr-9"
          />
          {search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
              onClick={clearSearch}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Bill Type Filter */}
        <Select
          value={searchParams.get('billType') || 'all'}
          onValueChange={(value) => updateSearchParams({ billType: value })}
        >
          <SelectTrigger className="w-full md:w-[160px]">
            <SelectValue placeholder="Bill Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Bills</SelectItem>
            <SelectItem value="HB">House Bills</SelectItem>
            <SelectItem value="SB">Senate Bills</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort By */}
        <Select
          value={searchParams.get('sortBy') || 'billNumber'}
          onValueChange={(value) => updateSearchParams({ sortBy: value })}
        >
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="billNumber">Bill Number</SelectItem>
            <SelectItem value="description">Description</SelectItem>
            <SelectItem value="lastActionDate">Last Action</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort Order */}
        <Select
          value={searchParams.get('sortOrder') || 'asc'}
          onValueChange={(value) => updateSearchParams({ sortOrder: value })}
        >
          <SelectTrigger className="w-full md:w-[140px]">
            <SelectValue placeholder="Order" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="asc">Ascending</SelectItem>
            <SelectItem value="desc">Descending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Search hint */}
      <p className="text-xs text-muted-foreground">
        Tip: Use AND, OR, NOT for advanced search. Example: &quot;education AND
        funding NOT tax&quot;
      </p>
    </div>
  );
}
