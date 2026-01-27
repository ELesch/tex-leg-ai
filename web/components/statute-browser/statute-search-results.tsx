'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FileText, Sparkles, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchResult {
  id: string;
  codeAbbr: string;
  codeName: string;
  chapterNum: string;
  chapterTitle: string | null;
  subchapter: string | null;
  sectionNum: string;
  heading: string | null;
  matchCount?: number;
  snippet: string;
  relevanceScore?: number;
  relevanceExplanation?: string;
}

interface StatuteSearchResultsProps {
  results: SearchResult[];
  query: string;
  isSemanticSearch?: boolean;
  onResultClick?: (result: SearchResult) => void;
  selectedResultId?: string;
  className?: string;
}

// Highlight search terms in text
function highlightTerms(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  // Extract search terms (ignore AND/OR/NOT)
  const terms = query
    .split(/\s+/)
    .filter(t => !['AND', 'OR', 'NOT'].includes(t.toUpperCase()))
    .map(t => t.replace(/"/g, ''));

  if (terms.length === 0) return text;

  // Build regex for all terms
  const pattern = new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');

  const parts = text.split(pattern);

  return parts.map((part, i) => {
    const isMatch = terms.some(t => part.toLowerCase() === t.toLowerCase());
    if (isMatch) {
      return (
        <mark key={i} className="bg-amber-300/80 dark:bg-amber-700/70 rounded-sm px-0.5">
          {part}
        </mark>
      );
    }
    return part;
  });
}

export function StatuteSearchResults({
  results,
  query,
  isSemanticSearch = false,
  onResultClick,
  selectedResultId,
  className,
}: StatuteSearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className={cn('p-4 text-center', className)}>
        <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No results found for "{query}"
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn('h-full', className)}>
      <div className="p-2 space-y-2">
        <div className="text-xs text-muted-foreground px-2 py-1">
          {results.length} result{results.length !== 1 ? 's' : ''} found
        </div>

        {results.map(result => (
          <button
            key={result.id}
            className={cn(
              'w-full text-left p-3 rounded-md border transition-colors',
              'hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring',
              selectedResultId === result.id && 'bg-accent border-primary'
            )}
            onClick={() => onResultClick?.(result)}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="font-medium text-sm">
                  {result.codeAbbr} § {result.sectionNum}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {result.matchCount && !isSemanticSearch && (
                  <Badge variant="secondary" className="text-xs">
                    {result.matchCount} match{result.matchCount !== 1 ? 'es' : ''}
                  </Badge>
                )}
                {result.relevanceScore && isSemanticSearch && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-xs',
                      result.relevanceScore >= 8 && 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                      result.relevanceScore >= 6 && result.relevanceScore < 8 && 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    )}
                  >
                    <Sparkles className="h-3 w-3 mr-0.5" />
                    {result.relevanceScore}/10
                  </Badge>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {/* Heading */}
            {result.heading && (
              <div className="text-xs text-muted-foreground mb-1 line-clamp-1">
                {result.heading}
              </div>
            )}

            {/* Location */}
            <div className="text-xs text-muted-foreground mb-2">
              {result.codeName}, Ch. {result.chapterNum}
              {result.subchapter && `, Subch. ${result.subchapter}`}
            </div>

            {/* Snippet */}
            <div className="text-sm text-muted-foreground line-clamp-2">
              {isSemanticSearch ? result.snippet : highlightTerms(result.snippet, query)}
            </div>

            {/* Semantic relevance explanation */}
            {isSemanticSearch && result.relevanceExplanation && (
              <div className="mt-2 text-xs text-muted-foreground bg-purple-50 dark:bg-purple-950/30 p-2 rounded">
                <Sparkles className="h-3 w-3 inline-block mr-1 text-purple-500" />
                {result.relevanceExplanation}
              </div>
            )}
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
