'use client';

import { useState, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionData {
  id: string;
  sectionNum: string;
  heading: string | null;
  subchapter: string | null;
  subchapterTitle: string | null;
  text: string;
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
  sections: SectionData[];
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

// Determine indent level based on subsection markers
function getIndentLevel(line: string): number {
  const trimmed = line.trim();
  if (/^\([a-z]\)/.test(trimmed)) return 1;        // (a), (b), (c)
  if (/^\(\d+\)/.test(trimmed)) return 2;          // (1), (2), (3)
  if (/^\([A-Z]\)/.test(trimmed)) return 3;        // (A), (B), (C)
  if (/^\([ivxlcdm]+\)/i.test(trimmed)) return 4;  // (i), (ii), (iii)
  return 0;
}

// Render text with indentation for subsection markers
function renderIndentedText(text: string, hideRevisionHistory: boolean) {
  const processedText = hideRevisionHistory ? filterRevisionHistory(text) : text;
  const lines = processedText.split('\n');

  return lines.map((line, i) => {
    const indent = getIndentLevel(line);
    return (
      <div
        key={i}
        className={cn(
          'leading-relaxed',
          indent > 0 && `ml-${indent * 4}`
        )}
        style={{ marginLeft: indent > 0 ? `${indent * 1.5}rem` : undefined }}
      >
        {line || '\u00A0'}
      </div>
    );
  });
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
  }, {} as Record<string, SectionData[]>) || {};

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
                      {section.sectionNum}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Structured chapter content with indentation */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Chapter header */}
          <h2 className="text-lg font-bold mb-4">
            CHAPTER {chapterData.chapter}. {chapterData.chapterTitle || ''}
          </h2>

          {/* Sections grouped by subchapter */}
          {Object.entries(sectionsBySubchapter).map(([subchapter, sections]) => (
            <div key={subchapter} className="mb-6">
              {/* Subchapter header */}
              {subchapter !== '__none__' && (
                <div className="ml-4 mb-4">
                  <h3 className="font-semibold text-base border-b pb-1 mb-3">
                    SUBCHAPTER {subchapter}. {sections[0]?.subchapterTitle || ''}
                  </h3>
                </div>
              )}

              {/* Sections */}
              {sections.map(section => (
                <div
                  key={section.id}
                  className={cn(
                    'mb-6',
                    subchapter !== '__none__' ? 'ml-8' : 'ml-4'
                  )}
                >
                  {/* Section header */}
                  <button
                    className="font-medium text-sm mb-2 hover:text-primary cursor-pointer text-left"
                    onClick={() => onSectionClick?.(section.sectionNum)}
                  >
                    Sec. {section.sectionNum}. {section.heading || ''}
                  </button>

                  {/* Section text with indentation */}
                  <div className="text-sm font-mono">
                    {renderIndentedText(section.text, hideRevisionHistory)}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
