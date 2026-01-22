'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  StickyNote,
  HelpCircle,
  AlertTriangle,
  Highlighter,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type AnnotationType = 'NOTE' | 'QUESTION' | 'CONCERN' | 'HIGHLIGHT';

export interface Annotation {
  id: string;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  content: string;
  type: AnnotationType;
  createdAt?: string;
}

interface PersonalAnnotationPanelProps {
  billId: string;
  annotations: Annotation[];
  onAnnotationClick?: (annotationId: string) => void;
  onAnnotationDelete?: (annotationId: string) => void;
  selectedAnnotationId?: string | null;
  className?: string;
}

const typeIcons: Record<AnnotationType, typeof StickyNote> = {
  NOTE: StickyNote,
  QUESTION: HelpCircle,
  CONCERN: AlertTriangle,
  HIGHLIGHT: Highlighter,
};

const typeColors: Record<AnnotationType, string> = {
  NOTE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  QUESTION: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  CONCERN: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  HIGHLIGHT: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

const typeLabels: Record<AnnotationType, string> = {
  NOTE: 'Note',
  QUESTION: 'Question',
  CONCERN: 'Concern',
  HIGHLIGHT: 'Highlight',
};

type FilterType = 'all' | AnnotationType;

interface AnnotationItemProps {
  annotation: Annotation;
  isSelected: boolean;
  onClick?: () => void;
  onDelete?: () => void;
}

function AnnotationItem({
  annotation,
  isSelected,
  onClick,
  onDelete,
}: AnnotationItemProps) {
  const Icon = typeIcons[annotation.type];
  const timeAgo = annotation.createdAt
    ? formatDistanceToNow(new Date(annotation.createdAt), { addSuffix: true })
    : null;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this annotation?')) {
      onDelete?.();
    }
  };

  return (
    <div
      className={cn(
        'p-3 rounded-lg border cursor-pointer transition-colors',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'hover:border-primary/50 hover:bg-muted/50'
      )}
      onClick={onClick}
    >
      {/* Header with type badge */}
      <div className="flex items-start justify-between gap-2">
        <Badge className={cn('gap-1', typeColors[annotation.type])} variant="secondary">
          <Icon className="h-3 w-3" />
          {typeLabels[annotation.type]}
        </Badge>
        <div className="flex gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onClick}
            title="Go to annotation in text"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={handleDelete}
              title="Delete annotation"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Selected text preview */}
      <div className="mt-2 text-xs bg-muted p-2 rounded italic line-clamp-2">
        &ldquo;{annotation.selectedText.substring(0, 100)}
        {annotation.selectedText.length > 100 ? '...' : ''}&rdquo;
      </div>

      {/* Annotation content */}
      {annotation.content && (
        <p className="mt-2 text-sm line-clamp-3">{annotation.content}</p>
      )}

      {/* Creation date */}
      {timeAgo && (
        <p className="mt-2 text-xs text-muted-foreground">{timeAgo}</p>
      )}
    </div>
  );
}

export function PersonalAnnotationPanel({
  billId: _billId,
  annotations,
  onAnnotationClick,
  onAnnotationDelete,
  selectedAnnotationId,
  className,
}: PersonalAnnotationPanelProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  // Filter annotations by type
  const filteredAnnotations = useMemo(() => {
    if (filter === 'all') {
      return annotations;
    }
    return annotations.filter((a) => a.type === filter);
  }, [annotations, filter]);

  // Sort by position in document (startOffset)
  const sortedAnnotations = useMemo(() => {
    return [...filteredAnnotations].sort((a, b) => a.startOffset - b.startOffset);
  }, [filteredAnnotations]);

  // Count by type for filter display
  const counts = useMemo(() => {
    const result: Record<FilterType, number> = {
      all: annotations.length,
      NOTE: 0,
      QUESTION: 0,
      CONCERN: 0,
      HIGHLIGHT: 0,
    };
    for (const annotation of annotations) {
      result[annotation.type]++;
    }
    return result;
  }, [annotations]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header with filter */}
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm">
          My Annotations ({counts.all})
        </h3>
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({counts.all})</SelectItem>
            <SelectItem value="NOTE">
              Notes ({counts.NOTE})
            </SelectItem>
            <SelectItem value="QUESTION">
              Questions ({counts.QUESTION})
            </SelectItem>
            <SelectItem value="CONCERN">
              Concerns ({counts.CONCERN})
            </SelectItem>
            <SelectItem value="HIGHLIGHT">
              Highlights ({counts.HIGHLIGHT})
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Annotations list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {sortedAnnotations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                {filter === 'all'
                  ? 'No annotations yet'
                  : `No ${typeLabels[filter as AnnotationType].toLowerCase()}s found`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Select text in the bill and right-click to add an annotation
              </p>
            </div>
          ) : (
            sortedAnnotations.map((annotation) => (
              <AnnotationItem
                key={annotation.id}
                annotation={annotation}
                isSelected={selectedAnnotationId === annotation.id}
                onClick={() => onAnnotationClick?.(annotation.id)}
                onDelete={
                  onAnnotationDelete
                    ? () => onAnnotationDelete(annotation.id)
                    : undefined
                }
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Export types and utilities for use elsewhere
export { typeIcons, typeColors, typeLabels };
