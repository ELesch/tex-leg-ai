'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, Loader2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface StatuteSearchBarProps {
  codeAbbr?: string;
  chapterNum?: string;
  onSearch: (query: string, isSemanticSearch: boolean) => void;
  onClear: () => void;
  isSearching?: boolean;
  resultCount?: number;
  currentMatchIndex?: number;
  onNavigateMatch?: (direction: 'prev' | 'next') => void;
  className?: string;
}

export function StatuteSearchBar({
  codeAbbr,
  chapterNum,
  onSearch,
  onClear,
  isSearching = false,
  resultCount = 0,
  currentMatchIndex,
  onNavigateMatch,
  className,
}: StatuteSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isSemanticMode, setIsSemanticMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Handle search submission
  const handleSearch = useCallback(() => {
    if (!query.trim()) return;
    onSearch(query.trim(), isSemanticMode);
  }, [query, isSemanticMode, onSearch]);

  // Debounced search for keyword mode
  useEffect(() => {
    if (isSemanticMode) return; // No debounce for semantic search

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim()) {
      debounceRef.current = setTimeout(() => {
        onSearch(query.trim(), false);
      }, 300);
    } else {
      onClear();
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, isSemanticMode, onSearch, onClear]);

  // Handle clear
  const handleClear = useCallback(() => {
    setQuery('');
    onClear();
    inputRef.current?.focus();
  }, [onClear]);

  // Handle key down
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    } else if (e.key === 'Escape') {
      handleClear();
    } else if (e.key === 'F3' || (e.key === 'g' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      if (e.shiftKey) {
        onNavigateMatch?.('prev');
      } else {
        onNavigateMatch?.('next');
      }
    }
  }, [handleSearch, handleClear, onNavigateMatch]);

  // Toggle search mode
  const toggleSearchMode = useCallback(() => {
    setIsSemanticMode(prev => !prev);
  }, []);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={isSemanticMode ? 'Ask a question about the statute...' : 'Search (AND/OR/NOT supported)...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9 pr-20"
          />
          <div className="absolute right-2 top-1.5 flex items-center gap-1">
            {query && !isSearching && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleClear}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
            {isSearching && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Semantic search toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isSemanticMode ? 'default' : 'outline'}
              size="icon"
              className="h-9 w-9"
              onClick={toggleSearchMode}
            >
              <Sparkles className={cn('h-4 w-4', isSemanticMode && 'text-primary-foreground')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isSemanticMode ? 'Switch to keyword search' : 'Switch to AI semantic search'}</p>
          </TooltipContent>
        </Tooltip>

        {/* Submit button for semantic search */}
        {isSemanticMode && (
          <Button
            size="sm"
            onClick={handleSearch}
            disabled={!query.trim() || isSearching}
          >
            Search
          </Button>
        )}
      </div>

      {/* Search mode indicator and filters */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Badge variant={isSemanticMode ? 'default' : 'secondary'} className="text-xs">
            {isSemanticMode ? 'AI Search' : 'Keyword'}
          </Badge>
          {codeAbbr && (
            <span className="text-muted-foreground">
              in {codeAbbr}
              {chapterNum && ` Ch. ${chapterNum}`}
            </span>
          )}
        </div>

        {/* Match navigation */}
        {resultCount > 0 && currentMatchIndex !== undefined && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">
              {currentMatchIndex + 1} of {resultCount}
            </span>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onNavigateMatch?.('prev')}
                disabled={currentMatchIndex <= 0}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onNavigateMatch?.('next')}
                disabled={currentMatchIndex >= resultCount - 1}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Search tips */}
      {!isSemanticMode && !query && (
        <div className="text-xs text-muted-foreground">
          Tip: Use AND, OR, NOT operators (e.g., &quot;education AND school NOT federal&quot;)
        </div>
      )}
    </div>
  );
}
