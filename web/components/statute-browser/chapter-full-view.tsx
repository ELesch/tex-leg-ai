'use client';

import { useState, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, FileText, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionSummary {
  id: string;
  sectionNum: string;
  heading: string | null;
  subchapter: string | null;
  textLength: number;
}

interface ChapterData {
  code: string;
  codeName: string;
  chapter: string;
  chapterTitle: string | null;
  sectionCount: number;
  subchapters: string[];
  fullText: string;
  sections: SectionSummary[];
}

interface ChapterFullViewProps {
  codeAbbr: string;
  chapterNum: string;
  hideRevisionHistory?: boolean;
  onSectionClick?: (sectionNum: string) => void;
  className?: string;
}

// Patterns for revision history that can be hidden
const revisionPatterns = [
  /Added by Acts \d{4}.*?(?=\n|$)/g,
  /Amended by Acts \d{4}.*?(?=\n|$)/g,
  /Redesignated from.*?(?=\n|$)/g,
  /Renumbered from.*?(?=\n|$)/g,
  /Text of.*?(?=\n|$)/g,
];

function filterRevisionHistory(content: string): string {
  let filtered = content;
  for (const pattern of revisionPatterns) {
    filtered = filtered.replace(pattern, '');
  }
  return filtered.replace(/\n{3,}/g, '\n\n');
}

export function ChapterFullView({
  codeAbbr,
  chapterNum,
  hideRevisionHistory = false,
  onSectionClick,
  className,
}: ChapterFullViewProps) {
  const [chapterData, setChapterData] = useState<ChapterData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSubchapters, setExpandedSubchapters] = useState<Set<string>>(new Set());

  // Fetch chapter data
  const fetchChapter = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/statutes/${encodeURIComponent(codeAbbr)}/chapters/${encodeURIComponent(chapterNum)}/full`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch chapter');
      }

      const data = await response.json();
      setChapterData(data);

      // Expand all subchapters by default
      if (data.subchapters) {
        setExpandedSubchapters(new Set(data.subchapters));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [codeAbbr, chapterNum]);

  useEffect(() => {
    fetchChapter();
  }, [fetchChapter]);

  // Toggle subchapter expansion
  const toggleSubchapter = (subchapter: string) => {
    setExpandedSubchapters(prev => {
      const next = new Set(prev);
      if (next.has(subchapter)) {
        next.delete(subchapter);
      } else {
        next.add(subchapter);
      }
      return next;
    });
  };

  // Group sections by subchapter
  const sectionsBySubchapter = chapterData?.sections.reduce((acc, section) => {
    const key = section.subchapter || '__none__';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(section);
    return acc;
  }, {} as Record<string, SectionSummary[]>) || {};

  if (isLoading) {
    return (
      <div className={cn('p-4 space-y-4', className)}>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4', className)}>
        <div className="text-center py-8">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchChapter}
            className="mt-2"
          >
            <Loader2 className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!chapterData) {
    return (
      <div className={cn('p-4', className)}>
        <p className="text-center text-sm text-muted-foreground">
          No chapter data available
        </p>
      </div>
    );
  }

  const displayText = hideRevisionHistory
    ? filterRevisionHistory(chapterData.fullText)
    : chapterData.fullText;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold text-lg">
            {chapterData.codeName} - Chapter {chapterData.chapter}
          </h2>
        </div>
        {chapterData.chapterTitle && (
          <p className="text-sm text-muted-foreground mb-2">
            {chapterData.chapterTitle}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {chapterData.sectionCount} sections
          </Badge>
          {chapterData.subchapters.length > 0 && (
            <Badge variant="outline">
              {chapterData.subchapters.length} subchapters
            </Badge>
          )}
        </div>
      </div>

      {/* Table of contents */}
      <div className="flex-shrink-0 p-3 border-b bg-muted/30">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          Jump to section
        </div>
        <div className="max-h-32 overflow-auto">
          {Object.entries(sectionsBySubchapter).map(([subchapter, sections]) => (
            <div key={subchapter} className="mb-1">
              {subchapter !== '__none__' && (
                <button
                  className="flex items-center gap-1 text-xs font-medium hover:text-foreground text-muted-foreground w-full"
                  onClick={() => toggleSubchapter(subchapter)}
                >
                  {expandedSubchapters.has(subchapter) ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  Subchapter {subchapter}
                </button>
              )}
              {(subchapter === '__none__' || expandedSubchapters.has(subchapter)) && (
                <div className={cn('flex flex-wrap gap-1', subchapter !== '__none__' && 'ml-4 mt-1')}>
                  {sections.map(section => (
                    <button
                      key={section.id}
                      className="text-xs px-1.5 py-0.5 rounded bg-background hover:bg-accent border"
                      onClick={() => onSectionClick?.(section.sectionNum)}
                    >
                      §{section.sectionNum}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Full chapter text */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
            {displayText}
          </pre>
        </div>
      </ScrollArea>
    </div>
  );
}
