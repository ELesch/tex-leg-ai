'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnnotatableStatuteText, StatuteAnnotation } from './annotatable-statute-text';

interface SectionData {
  id: string;
  sectionNum: string;
  heading: string | null;
  text: string;
  textLength: number;
}

interface SubchapterData {
  code: string;
  codeName: string;
  chapter: string;
  chapterTitle: string | null;
  subchapter: string;
  subchapterTitle: string | null;
  sectionCount: number;
  sections: SectionData[];
}

interface SubchapterFullViewProps {
  codeAbbr: string;
  chapterNum: string;
  subchapter: string;
  hideRevisionHistory?: boolean;
  onSectionClick?: (sectionNum: string) => void;
  className?: string;
}

export function SubchapterFullView({
  codeAbbr,
  chapterNum,
  subchapter,
  hideRevisionHistory = false,
  onSectionClick,
  className,
}: SubchapterFullViewProps) {
  const { data: session } = useSession();
  const [subchapterData, setSubchapterData] = useState<SubchapterData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Annotations state - keyed by section ID
  const [annotationsBySectionId, setAnnotationsBySectionId] = useState<Record<string, StatuteAnnotation[]>>({});

  // Fetch subchapter data
  const fetchSubchapter = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/statutes/${encodeURIComponent(codeAbbr)}/chapters/${encodeURIComponent(chapterNum)}/subchapters/${encodeURIComponent(subchapter)}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch subchapter');
      }

      const data = await response.json();
      setSubchapterData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [codeAbbr, chapterNum, subchapter]);

  useEffect(() => {
    fetchSubchapter();
  }, [fetchSubchapter]);

  // Fetch annotations for all sections in the subchapter
  useEffect(() => {
    if (!session?.user || !subchapterData?.sections) {
      setAnnotationsBySectionId({});
      return;
    }

    async function fetchAllAnnotations() {
      const annotationsMap: Record<string, StatuteAnnotation[]> = {};

      await Promise.all(
        subchapterData!.sections.map(async (section) => {
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
  }, [session?.user, subchapterData, codeAbbr]);

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
            onClick={fetchSubchapter}
            className="mt-2"
          >
            <Loader2 className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!subchapterData) {
    return (
      <div className={cn('p-4', className)}>
        <p className="text-center text-sm text-muted-foreground">
          No subchapter data available
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
            {subchapterData.codeName} - Chapter {subchapterData.chapter}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-2">
          Subchapter {subchapterData.subchapter}
          {subchapterData.subchapterTitle && `. ${subchapterData.subchapterTitle}`}
        </p>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {subchapterData.sectionCount} sections
          </Badge>
        </div>
      </div>

      {/* Table of contents */}
      <div className="flex-shrink-0 p-3 border-b bg-muted/30">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          Jump to section
        </div>
        <div className="max-h-32 overflow-auto">
          <div className="flex flex-wrap gap-1">
            {subchapterData.sections.map(section => (
              <button
                key={section.id}
                className="text-xs px-1.5 py-0.5 rounded bg-background hover:bg-accent border"
                onClick={() => onSectionClick?.(section.sectionNum)}
              >
                {section.sectionNum}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Structured subchapter content with indentation */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Subchapter header */}
          <h2 className="text-lg font-bold mb-2">
            CHAPTER {subchapterData.chapter}. {subchapterData.chapterTitle || ''}
          </h2>
          <h3 className="font-semibold text-base border-b pb-1 mb-4 ml-4">
            SUBCHAPTER {subchapterData.subchapter}. {subchapterData.subchapterTitle || ''}
          </h3>

          {/* Sections */}
          {subchapterData.sections.map(section => (
            <div
              key={section.id}
              className="mb-6 ml-8"
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
      </ScrollArea>
    </div>
  );
}
