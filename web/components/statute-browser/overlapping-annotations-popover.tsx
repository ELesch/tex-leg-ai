'use client';

import * as React from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  StickyNote,
  HelpCircle,
  AlertTriangle,
  Highlighter,
  Pencil,
  Trash2,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StatuteAnnotation, AnnotationType } from './statute-annotation-popover';

interface OverlappingAnnotationsPopoverProps {
  annotations: StatuteAnnotation[];
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onEdit?: (annotationId: string) => void;
  onDelete?: (annotationId: string) => void;
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

export function OverlappingAnnotationsPopover({
  annotations,
  children,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: OverlappingAnnotationsPopoverProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <Popover open={open} onOpenChange={onOpenChange}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
          </TooltipTrigger>
          {/* Hover preview tooltip */}
          <TooltipContent
            side="top"
            className="max-w-xs p-2"
            hidden={open}
          >
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">{annotations.length} overlapping annotations</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {annotations.slice(0, 3).map((ann) => {
                const Icon = typeIcons[ann.type];
                return (
                  <Badge
                    key={ann.id}
                    className={cn('gap-1 text-xs', typeColors[ann.type])}
                    variant="secondary"
                  >
                    <Icon className="h-2.5 w-2.5" />
                    {typeLabels[ann.type]}
                  </Badge>
                );
              })}
              {annotations.length > 3 && (
                <span className="text-xs text-muted-foreground">+{annotations.length - 3} more</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Click to view all</p>
          </TooltipContent>
          {/* Full popover with list of annotations */}
          <PopoverContent
            className="w-96 p-0"
            align="start"
            sideOffset={8}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="p-3 border-b">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium text-sm">{annotations.length} Overlapping Annotations</h4>
              </div>
            </div>
            <ScrollArea className="max-h-80">
              <div className="divide-y">
                {annotations.map((annotation) => {
                  const Icon = typeIcons[annotation.type];
                  const timeAgo = annotation.createdAt
                    ? formatDistanceToNow(new Date(annotation.createdAt), { addSuffix: true })
                    : null;

                  return (
                    <div key={annotation.id} className="p-3 space-y-2 hover:bg-muted/50">
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
                              className="h-6 w-6"
                              onClick={() => onEdit(annotation.id)}
                            >
                              <Pencil className="h-3 w-3" />
                              <span className="sr-only">Edit annotation</span>
                            </Button>
                          )}
                          {onDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => onDelete(annotation.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                              <span className="sr-only">Delete annotation</span>
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Annotation content */}
                      {annotation.content && (
                        <p className="text-sm leading-relaxed line-clamp-3">{annotation.content}</p>
                      )}

                      {/* Selected text preview */}
                      <div className="text-xs bg-muted p-1.5 rounded italic line-clamp-1">
                        &ldquo;{annotation.selectedText.substring(0, 80)}
                        {annotation.selectedText.length > 80 ? '...' : ''}&rdquo;
                      </div>

                      {/* Creation date */}
                      {timeAgo && (
                        <p className="text-xs text-muted-foreground">{timeAgo}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </Tooltip>
    </TooltipProvider>
  );
}
