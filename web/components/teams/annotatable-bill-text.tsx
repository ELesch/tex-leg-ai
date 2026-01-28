'use client';

import * as React from 'react';
import { useCallback, useRef, useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  StickyNote,
  HelpCircle,
  AlertTriangle,
  Highlighter,
  Check,
  Layers,
} from 'lucide-react';
import { AnnotationType } from '@prisma/client';

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export interface BillAnnotation {
  id: string;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  content: string;
  type: AnnotationType;
  resolved: boolean;
  user: User;
  createdAt: string;
  updatedAt: string;
}

export interface AnnotatableBillTextProps {
  content: string;
  annotations: BillAnnotation[];
  canAnnotate: boolean;
  onTextSelect: (selection: {
    startOffset: number;
    endOffset: number;
    selectedText: string;
  }) => void;
  onAnnotationClick: (annotationId: string) => void;
  selectedAnnotationId?: string | null;
}

// Highlight colors for different annotation types
export const highlightColors: Record<AnnotationType, string> = {
  NOTE: 'bg-yellow-200/70 dark:bg-yellow-900/50 hover:bg-yellow-300/80 dark:hover:bg-yellow-800/60',
  QUESTION: 'bg-blue-200/70 dark:bg-blue-900/50 hover:bg-blue-300/80 dark:hover:bg-blue-800/60',
  CONCERN: 'bg-red-200/70 dark:bg-red-900/50 hover:bg-red-300/80 dark:hover:bg-red-800/60',
  HIGHLIGHT: 'bg-green-200/70 dark:bg-green-900/50 hover:bg-green-300/80 dark:hover:bg-green-800/60',
};

// Visual styles for overlapping annotations
export const overlapColors = {
  two: 'bg-gradient-to-r from-yellow-200/60 via-blue-200/60 to-yellow-200/60 dark:from-yellow-900/40 dark:via-blue-900/40 dark:to-yellow-900/40',
  multiple: 'bg-purple-200/60 dark:bg-purple-900/40 ring-1 ring-purple-400/50 dark:ring-purple-500/50',
};

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

interface TextSegment {
  text: string;
  start: number;
  end: number;
  annotations?: BillAnnotation[];
}

/**
 * Build segments of text with annotations applied.
 * Uses boundary-based splitting to properly handle overlapping annotations.
 */
function buildTextSegments(
  content: string,
  annotations: BillAnnotation[]
): TextSegment[] {
  // Collect all boundary points from annotations
  const boundaries = new Set<number>();
  boundaries.add(0);
  boundaries.add(content.length);

  // Add annotation boundaries
  for (const annotation of annotations) {
    if (annotation.startOffset >= 0 && annotation.startOffset <= content.length) {
      boundaries.add(annotation.startOffset);
    }
    if (annotation.endOffset >= 0 && annotation.endOffset <= content.length) {
      boundaries.add(annotation.endOffset);
    }
  }

  // Sort boundaries
  const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);

  // Build segments between each pair of boundaries
  const segments: TextSegment[] = [];

  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const start = sortedBoundaries[i];
    const end = sortedBoundaries[i + 1];

    if (start >= end) continue;

    // Find all annotations that cover this segment (excluding resolved ones from display)
    const coveringAnnotations = annotations.filter(
      (ann) => !ann.resolved && ann.startOffset <= start && ann.endOffset >= end
    );

    segments.push({
      text: content.slice(start, end),
      start,
      end,
      annotations: coveringAnnotations.length > 0 ? coveringAnnotations : undefined,
    });
  }

  return segments;
}

function getInitials(name: string | null, email: string) {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0].toUpperCase();
}

interface AnnotationPopoverProps {
  annotation: BillAnnotation;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClick?: () => void;
}

function AnnotationPopover({
  annotation,
  children,
  open,
  onOpenChange,
  onClick,
}: AnnotationPopoverProps) {
  const Icon = typeIcons[annotation.type];
  const timeAgo = formatDistanceToNow(new Date(annotation.createdAt), { addSuffix: true });

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <Popover open={open} onOpenChange={onOpenChange}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild onClick={onClick}>{children}</PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="max-w-xs p-2"
            hidden={open}
          >
            <div className="flex items-center gap-2 mb-1">
              <Badge className={cn('gap-1 text-xs', typeColors[annotation.type])} variant="secondary">
                <Icon className="h-3 w-3" />
                {typeLabels[annotation.type]}
              </Badge>
              {annotation.resolved && (
                <Badge variant="outline" className="text-green-600 gap-1 text-xs">
                  <Check className="h-2.5 w-2.5" />
                  Resolved
                </Badge>
              )}
            </div>
            <p className="text-xs line-clamp-2">{annotation.content || annotation.selectedText}</p>
            <p className="text-xs text-muted-foreground mt-1">Click to view in sidebar</p>
          </TooltipContent>
          <PopoverContent
            className="w-80 p-0"
            align="start"
            sideOffset={8}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="p-3 space-y-3">
              <div className="flex items-start justify-between">
                <Badge className={cn('gap-1', typeColors[annotation.type])} variant="secondary">
                  <Icon className="h-3 w-3" />
                  {typeLabels[annotation.type]}
                </Badge>
                {annotation.resolved && (
                  <Badge variant="outline" className="text-green-600">
                    <Check className="h-3 w-3 mr-1" />
                    Resolved
                  </Badge>
                )}
              </div>

              <div className="text-xs bg-muted p-2 rounded italic line-clamp-2">
                &ldquo;{annotation.selectedText.substring(0, 150)}
                {annotation.selectedText.length > 150 ? '...' : ''}&rdquo;
              </div>

              {annotation.content && (
                <p className="text-sm leading-relaxed">{annotation.content}</p>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Avatar className="h-4 w-4">
                  <AvatarImage src={annotation.user.image || undefined} />
                  <AvatarFallback className="text-[8px]">
                    {getInitials(annotation.user.name, annotation.user.email)}
                  </AvatarFallback>
                </Avatar>
                <span>{annotation.user.name || annotation.user.email} · {timeAgo}</span>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </Tooltip>
    </TooltipProvider>
  );
}

interface OverlappingAnnotationsPopoverProps {
  annotations: BillAnnotation[];
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onAnnotationClick?: (annotationId: string) => void;
}

function OverlappingAnnotationsPopover({
  annotations,
  children,
  open,
  onOpenChange,
  onAnnotationClick,
}: OverlappingAnnotationsPopoverProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <Popover open={open} onOpenChange={onOpenChange}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
          </TooltipTrigger>
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
                  const timeAgo = formatDistanceToNow(new Date(annotation.createdAt), { addSuffix: true });

                  return (
                    <div
                      key={annotation.id}
                      className="p-3 space-y-2 hover:bg-muted/50 cursor-pointer"
                      onClick={() => onAnnotationClick?.(annotation.id)}
                    >
                      <div className="flex items-start justify-between">
                        <Badge className={cn('gap-1', typeColors[annotation.type])} variant="secondary">
                          <Icon className="h-3 w-3" />
                          {typeLabels[annotation.type]}
                        </Badge>
                        {annotation.resolved && (
                          <Badge variant="outline" className="text-green-600">
                            <Check className="h-3 w-3 mr-1" />
                            Resolved
                          </Badge>
                        )}
                      </div>

                      {annotation.content && (
                        <p className="text-sm leading-relaxed line-clamp-3">{annotation.content}</p>
                      )}

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={annotation.user.image || undefined} />
                          <AvatarFallback className="text-[8px]">
                            {getInitials(annotation.user.name, annotation.user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{annotation.user.name || annotation.user.email} · {timeAgo}</span>
                      </div>
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

interface HighlightedTextProps {
  segment: TextSegment;
  onAnnotationClick?: (annotationId: string) => void;
  selectedAnnotationId?: string | null;
}

function HighlightedText({
  segment,
  onAnnotationClick,
  selectedAnnotationId,
}: HighlightedTextProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Plain text
  if (!segment.annotations?.length) {
    return <>{segment.text}</>;
  }

  const annotations = segment.annotations;

  // Single annotation
  if (annotations.length === 1) {
    const annotation = annotations[0];
    const isSelected = annotation.id === selectedAnnotationId;
    return (
      <AnnotationPopover
        annotation={annotation}
        open={isPopoverOpen}
        onOpenChange={setIsPopoverOpen}
        onClick={() => onAnnotationClick?.(annotation.id)}
      >
        <span
          data-annotation-id={annotation.id}
          className={cn(
            'cursor-pointer rounded-sm transition-all',
            highlightColors[annotation.type],
            isSelected && 'ring-2 ring-primary ring-offset-1'
          )}
        >
          {segment.text}
        </span>
      </AnnotationPopover>
    );
  }

  // Multiple overlapping annotations
  const overlapStyle = annotations.length === 2 ? overlapColors.two : overlapColors.multiple;
  const hasSelectedAnnotation = annotations.some((a) => a.id === selectedAnnotationId);

  return (
    <OverlappingAnnotationsPopover
      annotations={annotations}
      open={isPopoverOpen}
      onOpenChange={setIsPopoverOpen}
      onAnnotationClick={(id) => {
        setIsPopoverOpen(false);
        onAnnotationClick?.(id);
      }}
    >
      <span
        data-annotation-count={annotations.length}
        data-annotation-ids={annotations.map((a) => a.id).join(',')}
        className={cn(
          'cursor-pointer rounded-sm transition-all relative',
          overlapStyle,
          hasSelectedAnnotation && 'ring-2 ring-primary ring-offset-1'
        )}
      >
        {segment.text}
        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-3.5 h-3.5 text-[10px] font-medium bg-purple-500 text-white rounded-full">
          {annotations.length}
        </span>
      </span>
    </OverlappingAnnotationsPopover>
  );
}

interface SelectionMenuProps {
  position: { x: number; y: number } | null;
  onCreateAnnotation: () => void;
  onClose: () => void;
}

function SelectionMenu({ position, onCreateAnnotation, onClose }: SelectionMenuProps) {
  if (!position) return null;

  return (
    <DropdownMenu open={true} onOpenChange={(open) => !open && onClose()}>
      <DropdownMenuTrigger asChild>
        <div
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            width: 1,
            height: 1,
          }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem
          onClick={onCreateAnnotation}
          className="cursor-pointer"
        >
          <StickyNote className="mr-2 h-4 w-4" />
          Add Annotation
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AnnotatableBillText({
  content,
  annotations,
  canAnnotate,
  onTextSelect,
  onAnnotationClick,
  selectedAnnotationId,
}: AnnotatableBillTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{
    startOffset: number;
    endOffset: number;
    selectedText: string;
  } | null>(null);

  // Build text segments with annotations
  const segments = useMemo(
    () => buildTextSegments(content, annotations),
    [content, annotations]
  );

  // Split content into lines with their start offsets
  const linesWithOffsets = useMemo(() => {
    const lines: { text: string; startOffset: number; endOffset: number }[] = [];
    let offset = 0;
    const splitLines = content.split('\n');

    for (let i = 0; i < splitLines.length; i++) {
      const lineText = splitLines[i];
      const endOffset = offset + lineText.length;
      lines.push({
        text: lineText,
        startOffset: offset,
        endOffset: endOffset,
      });
      offset = endOffset + 1; // +1 for the newline character
    }
    return lines;
  }, [content]);

  // Get segments for a specific line
  const getSegmentsForLine = useCallback(
    (lineStart: number, lineEnd: number) => {
      return segments
        .filter((segment) => {
          // Segment overlaps with this line
          return segment.start < lineEnd && segment.end > lineStart;
        })
        .map((segment) => {
          // Clip segment to line boundaries
          const clippedStart = Math.max(segment.start, lineStart);
          const clippedEnd = Math.min(segment.end, lineEnd);
          const clippedText = content.slice(clippedStart, clippedEnd);

          return {
            ...segment,
            text: clippedText,
            start: clippedStart,
            end: clippedEnd,
          };
        });
    },
    [segments, content]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!canAnnotate) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !containerRef.current) {
        return;
      }

      const selectedText = selection.toString().trim();
      if (!selectedText || selectedText.length < 3) {
        return;
      }

      // Get the range and calculate offsets relative to the container
      const range = selection.getRangeAt(0);

      // Find the text offset within the bill content
      const startOffset = getTextOffset(containerRef.current, range.startContainer, range.startOffset);
      const endOffset = getTextOffset(containerRef.current, range.endContainer, range.endOffset);

      if (startOffset === -1 || endOffset === -1) {
        return;
      }

      setPendingSelection({
        startOffset,
        endOffset,
        selectedText,
      });
      setMenuPosition({ x: e.clientX, y: e.clientY });
    },
    [canAnnotate]
  );

  const handleCreateAnnotation = useCallback(() => {
    if (pendingSelection) {
      onTextSelect(pendingSelection);
    }
    setMenuPosition(null);
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  }, [pendingSelection, onTextSelect]);

  const handleCloseMenu = useCallback(() => {
    setMenuPosition(null);
    setPendingSelection(null);
  }, []);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        id="bill-content"
        className="font-sans text-sm leading-relaxed"
        onMouseUp={handleMouseUp}
      >
        {linesWithOffsets.map((line, lineIndex) => {
          const lineSegments = getSegmentsForLine(line.startOffset, line.endOffset);

          return (
            <div key={lineIndex} className="whitespace-pre-wrap">
              {lineSegments.length > 0 ? (
                lineSegments.map((segment, segIndex) => (
                  <HighlightedText
                    key={`${segment.start}-${segment.end}-${segIndex}`}
                    segment={segment}
                    onAnnotationClick={onAnnotationClick}
                    selectedAnnotationId={selectedAnnotationId}
                  />
                ))
              ) : (
                line.text || '\u00A0'
              )}
            </div>
          );
        })}
      </div>

      <SelectionMenu
        position={menuPosition}
        onCreateAnnotation={handleCreateAnnotation}
        onClose={handleCloseMenu}
      />
    </div>
  );
}

/**
 * Calculate the text offset of a node within a container.
 */
function getTextOffset(container: Node, targetNode: Node, targetOffset: number): number {
  let offset = 0;

  function walk(node: Node): boolean {
    if (node === targetNode) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += targetOffset;
      }
      return true;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      offset += node.textContent?.length || 0;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      for (const child of Array.from(node.childNodes)) {
        if (walk(child)) {
          return true;
        }
      }
    }

    return false;
  }

  // Handle case where targetNode is an element and offset refers to child index
  if (targetNode.nodeType === Node.ELEMENT_NODE && targetNode === container) {
    const children = Array.from(targetNode.childNodes);
    for (let i = 0; i < targetOffset && i < children.length; i++) {
      const child = children[i];
      if (child.nodeType === Node.TEXT_NODE) {
        offset += child.textContent?.length || 0;
      } else {
        offset += getFullTextLength(child);
      }
    }
    return offset;
  }

  if (walk(container)) {
    return offset;
  }

  return -1;
}

/**
 * Get the total text length of a node and all its children.
 */
function getFullTextLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.length || 0;
  }

  let length = 0;
  for (const child of Array.from(node.childNodes)) {
    length += getFullTextLength(child);
  }
  return length;
}
