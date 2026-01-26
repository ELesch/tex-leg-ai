'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, X, Filter, Loader2, Info } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

interface Bill {
  id: string;
  billId: string;
  billType: string;
  billNumber: number;
  description: string;
  authors: string[];
  status: string | null;
  lastActionDate: string | null;
}

interface SearchResult {
  bills: Bill[];
  total: number;
  page: number;
  totalPages: number;
}

export function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Search state
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [billType, setBillType] = useState(searchParams.get('type') || 'all');
  const [author, setAuthor] = useState(searchParams.get('author') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'relevance');

  // Results state
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const performSearch = useCallback(async (params: URLSearchParams) => {
    setIsLoading(true);
    setHasSearched(true);

    try {
      // Build search URL with all parameters
      const searchUrl = `/api/bills/search?${params.toString()}`;
      const res = await fetch(searchUrl);

      if (res.ok) {
        const data = await res.json();
        setResults(data);
      } else {
        setResults({ bills: [], total: 0, page: 1, totalPages: 0 });
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults({ bills: [], total: 0, page: 1, totalPages: 0 });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams();

      // Current values
      const currentValues = {
        q: query,
        type: billType,
        author: author,
        sort: sortBy,
      };

      // Apply updates
      Object.entries({ ...currentValues, ...updates }).forEach(([key, value]) => {
        if (value && value !== '' && value !== 'all' && value !== 'relevance') {
          params.set(key, value);
        }
      });

      // Update URL
      const queryString = params.toString();
      router.push(`/search${queryString ? `?${queryString}` : ''}`);

      // Perform search if there's a query
      if (updates.q || query) {
        performSearch(params);
      }
    },
    [router, query, billType, author, sortBy, performSearch]
  );

  const debouncedSearch = useDebouncedCallback((value: string) => {
    updateSearchParams({ q: value || null });
  }, 500);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateSearchParams({ q: query });
  };

  const clearFilters = () => {
    setQuery('');
    setBillType('all');
    setAuthor('');
    setSortBy('relevance');
    setResults(null);
    setHasSearched(false);
    router.push('/search');
  };

  // Load initial search if URL has params
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      const params = new URLSearchParams(searchParams.toString());
      performSearch(params);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-full flex-col">
      {/* Fixed header */}
      <div className="flex-shrink-0 p-6 pb-0">
        <h1 className="text-3xl font-bold">Advanced Search</h1>
        <p className="mt-1 text-muted-foreground">
          Search bills with advanced filters and boolean operators
        </p>
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
        {/* Search Form */}
        <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            <CardTitle>Search Bills</CardTitle>
          </div>
          <CardDescription>
            Use AND, OR, NOT operators for complex searches. Example: &quot;education AND funding NOT tax&quot;
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            {/* Main search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by keyword, bill number, or description..."
                value={query}
                onChange={handleQueryChange}
                className="pl-9 pr-9 h-12 text-lg"
              />
              {query && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                  onClick={() => {
                    setQuery('');
                    updateSearchParams({ q: null });
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Bill Type</label>
                <Select
                  value={billType}
                  onValueChange={(value) => {
                    setBillType(value);
                    updateSearchParams({ type: value });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="HB">House Bills (HB)</SelectItem>
                    <SelectItem value="SB">Senate Bills (SB)</SelectItem>
                    <SelectItem value="HJR">House Joint Resolutions (HJR)</SelectItem>
                    <SelectItem value="SJR">Senate Joint Resolutions (SJR)</SelectItem>
                    <SelectItem value="HCR">House Concurrent Resolutions (HCR)</SelectItem>
                    <SelectItem value="SCR">Senate Concurrent Resolutions (SCR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Author</label>
                <Input
                  placeholder="Filter by author name..."
                  value={author}
                  onChange={(e) => {
                    setAuthor(e.target.value);
                    debouncedSearch(query);
                  }}
                />
              </div>

              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Sort By</label>
                <Select
                  value={sortBy}
                  onValueChange={(value) => {
                    setSortBy(value);
                    updateSearchParams({ sort: value });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Relevance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="billNumber">Bill Number</SelectItem>
                    <SelectItem value="lastActionDate">Last Action Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1 md:flex-none">
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </Button>
                <Button type="button" variant="outline" onClick={clearFilters}>
                  <X className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Search Tips */}
      {!hasSearched && (
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-blue-900 dark:text-blue-100">Search Tips</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-blue-800 dark:text-blue-200">
            <ul className="space-y-2 list-disc list-inside">
              <li><strong>Basic search:</strong> Enter keywords to search bill descriptions</li>
              <li><strong>Bill number:</strong> Search directly by bill number (e.g., &quot;HB 1&quot; or &quot;SB 123&quot;)</li>
              <li><strong>AND operator:</strong> Find bills containing all terms (e.g., &quot;education AND funding&quot;)</li>
              <li><strong>OR operator:</strong> Find bills containing any term (e.g., &quot;tax OR revenue&quot;)</li>
              <li><strong>NOT operator:</strong> Exclude terms from results (e.g., &quot;healthcare NOT insurance&quot;)</li>
              <li><strong>Combine operators:</strong> Use multiple operators (e.g., &quot;education AND funding NOT federal&quot;)</li>
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Results */}
      {!isLoading && hasSearched && results && (
        <div className="space-y-4">
          {/* Results count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Found {results.total.toLocaleString()} bill{results.total !== 1 ? 's' : ''}
            </p>
            {(billType !== 'all' || author) && (
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Filters active</span>
              </div>
            )}
          </div>

          {/* Results Table */}
          {results.bills.length > 0 ? (
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
                  {results.bills.map((bill) => (
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
                          <Link
                            href={`/authors/${encodeURIComponent(bill.authors[0])}`}
                            className="text-sm hover:underline"
                          >
                            {bill.authors[0]}
                          </Link>
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
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
              <p className="text-lg font-medium text-muted-foreground">
                No bills found
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting your search terms or filters
              </p>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
