'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, ChevronDown, ChevronRight, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnnotatableStatuteText, StatuteAnnotation } from './annotatable-statute-text';
import {
  StatuteScrollbarMarkers,
  ScrollbarMarker,
} from './statute-scrollbar-markers';

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
  focusedSubchapter?: string | null;
  onSectionClick?: (sectionNum: string) => void;
  onSubchapterClick?: (subchapter: string) => void;
  onSubchapterFocus?: (subchapter: string) => void;
  onClearFocus?: () => void;
  className?: string;
}

export function ChapterFullView({
  codeAbbr,
  chapterNum,
  hideRevisionHistory = false,
  focusedSubchapter,
  onSectionClick,
  onSubchapterClick,
  onSubchapterFocus,
  onClearFocus,
  className,
}: ChapterFullViewProps) {
  const { data: session } = useSession();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [chapterData, setChapterData] = useState<ChapterData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSubchapters, setExpandedSubchapters] = useState<Set<string>>(new Set());

  // Annotations state - keyed by section ID
  const [annotationsBySectionId, setAnnotationsBySectionId] = useState<Record<string, StatuteAnnotation[]>>({});

  // Highlighted subchapter state for scroll-to effect
  const [highlightedSubchapter, setHighlightedSubchapter] = useState<string | null>(null);

  // Scroll state for scrollbar markers
  const [scrollState, setScrollState] = useState({ top: 0, height: 0, viewportHeight: 0 });

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

  // Fetch annotations for all sections in the chapter
  useEffect(() => {
    if (!session?.user || !chapterData?.sections) {
      setAnnotationsBySectionId({});
      return;
    }

    async function fetchAllAnnotations() {
      const annotationsMap: Record<string, StatuteAnnotation[]> = {};

      // Fetch annotations for each section
      await Promise.all(
        chapterData!.sections.map(async (section) => {
          try {
            const response = await fetch(
              `/api/statutes/${encodeURIComponent(codeAbbr)}/sections/${encodeURIComponent(section.sectionNum)}/annotations`
            );
            if (response.ok) {
              const data = await response.json();
              annotationsMap[section.id] = data.annotations || [];
            }
          } catch (error) {
            console.error(`Error fetching annotations for section ${section.sectionNum}:`, error);
          }
        })
      );

      setAnnotationsBySectionId(annotationsMap);
    }

    fetchAllAnnotations();
  }, [session?.user, chapterData, codeAbbr]);

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

  // Scroll to subchapter with persistent focus
  const scrollToSubchapter = useCallback((subchapter: string) => {
    const element = document.getElementById(`subchapter-${subchapter}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Trigger persistent focus for context binding
      onSubchapterFocus?.(subchapter);
      // Also trigger temporary highlight animation
      setHighlightedSubchapter(subchapter);
      setTimeout(() => setHighlightedSubchapter(null), 2000);
      onSubchapterClick?.(subchapter);
    }
  }, [onSubchapterClick, onSubchapterFocus]);

  // Handle annotation creation for a section
  const handleAnnotationCreate = useCallback(async (
    sectionNum: string,
    sectionId: string,
    annotation: { startOffset: number; endOffset: number; selectedText: string }
  ) => {
    if (!session?.user) return;

    const content = window.prompt('Enter your annotation:');
    if (!content) return;

    try {
      const response = await fetch(
        `/api/statutes/${encodeURIComponent(codeAbbr)}/sections/${encodeURIComponent(sectionNum)}/annotations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...annotation,
            content,
            type: 'NOTE',
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAnnotationsBySectionId(prev => ({
          ...prev,
          [sectionId]: [...(prev[sectionId] || []), data.annotation],
        }));
      }
    } catch (error) {
      console.error('Error creating annotation:', error);
    }
  }, [session?.user, codeAbbr]);

  // Handle annotation deletion
  const handleAnnotationDelete = useCallback(async (sectionId: string, annotationId: string) => {
    if (!session?.user) return;

    try {
      const response = await fetch(`/api/statutes/annotations/${annotationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAnnotationsBySectionId(prev => ({
          ...prev,
          [sectionId]: (prev[sectionId] || []).filter(a => a.id !== annotationId),
        }));
      }
    } catch (error) {
      console.error('Error deleting annotation:', error);
    }
  }, [session?.user]);

  // Group sections by subchapter
  const sectionsBySubchapter = chapterData?.sections.reduce((acc, section) => {
    const key = section.subchapter || '__none__';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(section);
    return acc;
  }, {} as Record<string, SectionData[]>) || {};

  // Calculate scrollbar markers from annotations across all sections
  const scrollbarMarkers: ScrollbarMarker[] = (() => {
    if (!chapterData?.sections) return [];

    // Calculate total text length and section offsets
    let totalLength = 0;
    const sectionOffsets: { id: string; offset: number; length: number }[] = [];

    for (const section of chapterData.sections) {
      sectionOffsets.push({
        id: section.id,
        offset: totalLength,
        length: section.text.length,
      });
      totalLength += section.text.length;
    }

    if (totalLength === 0) return [];

    // Calculate annotation markers with adjusted positions
    const markers: ScrollbarMarker[] = [];
    for (const { id, offset } of sectionOffsets) {
      const sectionAnnotations = annotationsBySectionId[id] || [];
      for (const annotation of sectionAnnotations) {
        // Map annotation position within section to overall position
        const overallPosition = (offset + annotation.startOffset) / totalLength;
        markers.push({
          position: overallPosition,
          type: 'annotation',
          id: annotation.id,
        });
      }
    }

    return markers;
  })();

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

      {/* Focused subchapter breadcrumb */}
      {focusedSubchapter && (
        <div className="flex-shrink-0 px-4 py-2 border-b bg-primary/5 flex items-center gap-2 text-sm">
          <button
            onClick={onClearFocus}
            className="text-primary hover:underline font-medium"
          >
            Chapter {chapterData.chapter}
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="text-foreground font-medium">
            Subchapter {focusedSubchapter}
          </span>
          <button
            onClick={onClearFocus}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            title="Press Esc to return to full chapter"
          >
            <X className="h-3 w-3" />
            <span>Clear focus</span>
          </button>
        </div>
      )}

      {/* Table of contents */}
      <div className="flex-shrink-0 p-3 border-b bg-muted/30">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          Jump to subchapter or section
        </div>
        <div className="max-h-32 overflow-auto">
          {Object.entries(sectionsBySubchapter).map(([subchapter, sections]) => (
            <div key={subchapter} className="mb-1">
              {subchapter !== '__none__' && (
                <div className="flex items-center gap-1">
                  <button
                    className="flex items-center text-xs hover:text-foreground text-muted-foreground"
                    onClick={() => toggleSubchapter(subchapter)}
                  >
                    {expandedSubchapters.has(subchapter) ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>
                  <button
                    className="text-xs font-medium hover:text-primary text-muted-foreground"
                    onClick={() => scrollToSubchapter(subchapter)}
                  >
                    Subchapter {subchapter}
                  </button>
                </div>
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
      <div className="flex-1 relative min-h-0 overflow-hidden">
        <ScrollArea
          className="h-full"
          ref={scrollAreaRef}
          onScrollCapture={(e) => {
            const target = e.target as HTMLElement;
            setScrollState({
              top: target.scrollTop,
              height: target.scrollHeight,
              viewportHeight: target.clientHeight,
            });
          }}
        >
          <div className="p-4 pr-6">
            {/* Chapter header */}
            <h2 className="text-lg font-bold mb-4">
              CHAPTER {chapterData.chapter}. {chapterData.chapterTitle || ''}
            </h2>

            {/* Sections grouped by subchapter */}
            {Object.entries(sectionsBySubchapter).map(([subchapter, sections]) => (
              <div
                key={subchapter}
                id={subchapter !== '__none__' ? `subchapter-${subchapter}` : undefined}
                className={cn(
                  'mb-6 transition-colors duration-1000 rounded-lg',
                  subchapter !== '__none__' && (highlightedSubchapter === subchapter || focusedSubchapter === subchapter) && 'bg-primary/10 ring-2 ring-primary/30',
                  subchapter !== '__none__' && '-mx-2 px-2 py-1'
                )}
              >
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

                    {/* Section text with annotations support */}
                    <div className="text-sm">
                      <AnnotatableStatuteText
                        content={section.text}
                        statuteId={section.id}
                        annotations={annotationsBySectionId[section.id] || []}
                        hideRevisionHistory={hideRevisionHistory}
                        onAnnotationCreate={session?.user ? (annotation) =>
                          handleAnnotationCreate(section.sectionNum, section.id, annotation) : undefined}
                        onAnnotationDelete={session?.user ? (annotationId) =>
                          handleAnnotationDelete(section.id, annotationId) : undefined}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Scrollbar markers overlay */}
        {scrollbarMarkers.length > 0 && (
          <StatuteScrollbarMarkers
            markers={scrollbarMarkers}
            contentHeight={scrollState.height}
            viewportHeight={scrollState.viewportHeight}
            scrollTop={scrollState.top}
            onMarkerClick={(marker) => {
              // Scroll to marker position
              const position = marker.position * scrollState.height;
              scrollAreaRef.current?.scrollTo({ top: position, behavior: 'smooth' });
            }}
          />
        )}
      </div>
    </div>
  );
}
