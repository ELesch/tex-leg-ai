'use client';

import * as React from 'react';
import { useCallback, useRef, useState, useMemo } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AnnotationPopover } from './annotation-popover';
import { cn } from '@/lib/utils';
import {
  StickyNote,
  HelpCircle,
  AlertTriangle,
  Highlighter,
} from 'lucide-react';

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

export interface AnnotatableBillTextProps {
  content: string;
  billId: string;
  annotations: Annotation[];
  onAnnotationCreate?: (annotation: {
    startOffset: number;
    endOffset: number;
    selectedText: string;
  }) => void;
  onAnnotationClick?: (annotationId: string) => void;
  onAnnotationEdit?: (annotationId: string) => void;
  onAnnotationDelete?: (annotationId: string) => void;
}

// Highlight colors for different annotation types
// Using the colors from the requirement: NOTE=yellow, QUESTION=blue, CONCERN=red, HIGHLIGHT=green
const highlightColors: Record<AnnotationType, string> = {
  NOTE: 'bg-yellow-200/70 dark:bg-yellow-900/50 hover:bg-yellow-300/80 dark:hover:bg-yellow-800/60',
  QUESTION: 'bg-blue-200/70 dark:bg-blue-900/50 hover:bg-blue-300/80 dark:hover:bg-blue-800/60',
  CONCERN: 'bg-red-200/70 dark:bg-red-900/50 hover:bg-red-300/80 dark:hover:bg-red-800/60',
  HIGHLIGHT: 'bg-green-200/70 dark:bg-green-900/50 hover:bg-green-300/80 dark:hover:bg-green-800/60',
};

const typeIcons: Record<AnnotationType, typeof StickyNote> = {
  NOTE: StickyNote,
  QUESTION: HelpCircle,
  CONCERN: AlertTriangle,
  HIGHLIGHT: Highlighter,
};

interface TextSegment {
  text: string;
  start: number;
  end: number;
  annotation?: Annotation;
}

/**
 * Build segments of text with annotations applied.
 * This handles non-overlapping annotations by sorting them and
 * creating segments for annotated and non-annotated portions.
 */
function buildTextSegments(content: string, annotations: Annotation[]): TextSegment[] {
  if (annotations.length === 0) {
    return [{ text: content, start: 0, end: content.length }];
  }

  // Sort annotations by start offset
  const sortedAnnotations = [...annotations].sort((a, b) => a.startOffset - b.startOffset);

  const segments: TextSegment[] = [];
  let currentPosition = 0;

  for (const annotation of sortedAnnotations) {
    // Skip if this annotation overlaps with a previous one
    if (annotation.startOffset < currentPosition) {
      continue;
    }

    // Add non-annotated text before this annotation
    if (annotation.startOffset > currentPosition) {
      segments.push({
        text: content.slice(currentPosition, annotation.startOffset),
        start: currentPosition,
        end: annotation.startOffset,
      });
    }

    // Add the annotated text
    segments.push({
      text: content.slice(annotation.startOffset, annotation.endOffset),
      start: annotation.startOffset,
      end: annotation.endOffset,
      annotation,
    });

    currentPosition = annotation.endOffset;
  }

  // Add any remaining non-annotated text
  if (currentPosition < content.length) {
    segments.push({
      text: content.slice(currentPosition),
      start: currentPosition,
      end: content.length,
    });
  }

  return segments;
}

interface HighlightedTextProps {
  segment: TextSegment;
  onAnnotationClick?: (annotationId: string) => void;
  onAnnotationEdit?: (annotationId: string) => void;
  onAnnotationDelete?: (annotationId: string) => void;
}

function HighlightedText({
  segment,
  onAnnotationClick,
  onAnnotationEdit,
  onAnnotationDelete,
}: HighlightedTextProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  if (!segment.annotation) {
    return <>{segment.text}</>;
  }

  const annotation = segment.annotation;

  return (
    <AnnotationPopover
      annotation={annotation}
      open={isPopoverOpen}
      onOpenChange={setIsPopoverOpen}
      onEdit={() => {
        setIsPopoverOpen(false);
        onAnnotationEdit?.(annotation.id);
      }}
      onDelete={() => {
        setIsPopoverOpen(false);
        onAnnotationDelete?.(annotation.id);
      }}
    >
      <span
        data-annotation-id={annotation.id}
        className={cn(
          'cursor-pointer rounded-sm transition-colors',
          highlightColors[annotation.type]
        )}
        onClick={() => onAnnotationClick?.(annotation.id)}
      >
        {segment.text}
      </span>
    </AnnotationPopover>
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
  billId: _billId,
  annotations,
  onAnnotationCreate,
  onAnnotationClick,
  onAnnotationEdit,
  onAnnotationDelete,
}: AnnotatableBillTextProps) {
  const containerRef = useRef<HTMLPreElement>(null);
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

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !containerRef.current) {
        return;
      }

      const selectedText = selection.toString().trim();
      if (!selectedText) {
        return;
      }

      // Get the range and calculate offsets relative to the container
      const range = selection.getRangeAt(0);

      // Find the text offset within the bill content
      // We need to walk through the DOM to find the actual position
      const startOffset = getTextOffset(containerRef.current, range.startContainer, range.startOffset);
      const endOffset = getTextOffset(containerRef.current, range.endContainer, range.endOffset);

      if (startOffset === -1 || endOffset === -1) {
        return;
      }

      e.preventDefault();

      setPendingSelection({
        startOffset,
        endOffset,
        selectedText,
      });
      setMenuPosition({ x: e.clientX, y: e.clientY });
    },
    []
  );

  const handleCreateAnnotation = useCallback(() => {
    if (pendingSelection && onAnnotationCreate) {
      onAnnotationCreate(pendingSelection);
    }
    setMenuPosition(null);
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  }, [pendingSelection, onAnnotationCreate]);

  const handleCloseMenu = useCallback(() => {
    setMenuPosition(null);
    setPendingSelection(null);
  }, []);

  return (
    <div className="relative">
      <pre
        ref={containerRef}
        className="whitespace-pre-wrap font-mono text-sm leading-relaxed"
        onContextMenu={handleContextMenu}
      >
        {segments.map((segment, index) => (
          <HighlightedText
            key={`${segment.start}-${segment.end}-${index}`}
            segment={segment}
            onAnnotationClick={onAnnotationClick}
            onAnnotationEdit={onAnnotationEdit}
            onAnnotationDelete={onAnnotationDelete}
          />
        ))}
      </pre>

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
 * This walks through all text nodes to find the absolute position.
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

// Export types and utilities for use in other components
export { highlightColors, typeIcons };
