'use client';

import * as React from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  StickyNote,
  HelpCircle,
  AlertTriangle,
  Highlighter,
  Pencil,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type AnnotationType = 'NOTE' | 'QUESTION' | 'CONCERN' | 'HIGHLIGHT';

export interface StatuteAnnotation {
  id: string;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  content: string;
  type: AnnotationType;
  createdAt?: string;
}

interface StatuteAnnotationPopoverProps {
  annotation: StatuteAnnotation;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
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

export function StatuteAnnotationPopover({
  annotation,
  children,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: StatuteAnnotationPopoverProps) {
  const Icon = typeIcons[annotation.type];
  const timeAgo = annotation.createdAt
    ? formatDistanceToNow(new Date(annotation.createdAt), { addSuffix: true })
    : null;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="start"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-3 space-y-3">
          {/* Header with type badge and actions */}
          <div className="flex items-start justify-between">
            <Badge className={cn('gap-1', typeColors[annotation.type])} variant="secondary">
              <Icon className="h-3 w-3" />
              {typeLabels[annotation.type]}
            </Badge>
            <div className="flex gap-1">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onEdit}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="sr-only">Edit annotation</span>
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Delete annotation</span>
                </Button>
              )}
            </div>
          </div>

          {/* Selected text preview */}
          <div className="text-xs bg-muted p-2 rounded italic line-clamp-2">
            &ldquo;{annotation.selectedText.substring(0, 150)}
            {annotation.selectedText.length > 150 ? '...' : ''}&rdquo;
          </div>

          {/* Annotation content */}
          {annotation.content && (
            <p className="text-sm leading-relaxed">{annotation.content}</p>
          )}

          {/* Creation date */}
          {timeAgo && (
            <p className="text-xs text-muted-foreground">Created {timeAgo}</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Export types for use elsewhere
export { typeIcons, typeColors, typeLabels };
