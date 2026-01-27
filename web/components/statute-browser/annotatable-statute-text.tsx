'use client';

import * as React from 'react';
import { useCallback, useRef, useState, useMemo } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatuteAnnotationPopover } from './statute-annotation-popover';
import { cn } from '@/lib/utils';
import { getIndentLevel, decodeHtmlEntities } from '@/lib/utils/statute-text-formatter';
import {
  StickyNote,
  HelpCircle,
  AlertTriangle,
  Highlighter,
} from 'lucide-react';

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

export interface SearchMatch {
  startOffset: number;
  endOffset: number;
  isSemanticMatch?: boolean;
}

export interface AnnotatableStatuteTextProps {
  content: string;
  statuteId: string;
  annotations: StatuteAnnotation[];
  searchMatches?: SearchMatch[];
  hideRevisionHistory?: boolean;
  onAnnotationCreate?: (annotation: {
    startOffset: number;
    endOffset: number;
    selectedText: string;
  }) => void;
  onAnnotationClick?: (annotationId: string) => void;
  onAnnotationEdit?: (annotationId: string) => void;
  onAnnotationDelete?: (annotationId: string) => void;
  onMatchClick?: (matchIndex: number) => void;
}

// Highlight colors for different annotation types
const highlightColors: Record<AnnotationType, string> = {
  NOTE: 'bg-yellow-200/70 dark:bg-yellow-900/50 hover:bg-yellow-300/80 dark:hover:bg-yellow-800/60',
  QUESTION: 'bg-blue-200/70 dark:bg-blue-900/50 hover:bg-blue-300/80 dark:hover:bg-blue-800/60',
  CONCERN: 'bg-red-200/70 dark:bg-red-900/50 hover:bg-red-300/80 dark:hover:bg-red-800/60',
  HIGHLIGHT: 'bg-green-200/70 dark:bg-green-900/50 hover:bg-green-300/80 dark:hover:bg-green-800/60',
};

// Search match colors
const searchMatchColor = 'bg-amber-300/80 dark:bg-amber-700/70';
const semanticMatchColor = 'bg-purple-300/80 dark:bg-purple-700/70';

const typeIcons: Record<AnnotationType, typeof StickyNote> = {
  NOTE: StickyNote,
  QUESTION: HelpCircle,
  CONCERN: AlertTriangle,
  HIGHLIGHT: Highlighter,
};

// Patterns for revision history that can be hidden
const revisionPatterns = [
  /Added by Acts \d{4}.*?(?=\n|$)/g,
  /Amended by Acts \d{4}.*?(?=\n|$)/g,
  /Redesignated from.*?(?=\n|$)/g,
  /Renumbered from.*?(?=\n|$)/g,
  /Text of.*?(?=\n|$)/g,
];

interface TextSegment {
  text: string;
  start: number;
  end: number;
  annotation?: StatuteAnnotation;
  searchMatch?: SearchMatch & { index: number };
}

/**
 * Filter out revision history text if requested
 */
function filterRevisionHistory(content: string): string {
  let filtered = content;
  for (const pattern of revisionPatterns) {
    filtered = filtered.replace(pattern, '');
  }
  // Clean up extra blank lines
  filtered = filtered.replace(/\n{3,}/g, '\n\n');
  return filtered;
}

/**
 * Build segments of text with annotations and search matches applied.
 */
function buildTextSegments(
  content: string,
  annotations: StatuteAnnotation[],
  searchMatches: SearchMatch[] = []
): TextSegment[] {
  // Combine all ranges (annotations take priority over search matches)
  const ranges: { start: number; end: number; annotation?: StatuteAnnotation; searchMatch?: SearchMatch & { index: number } }[] = [];

  // Add annotations
  for (const annotation of annotations) {
    ranges.push({
      start: annotation.startOffset,
      end: annotation.endOffset,
      annotation,
    });
  }

  // Add search matches (only if they don't overlap with annotations)
  searchMatches.forEach((match, index) => {
    const overlapsAnnotation = annotations.some(
      a => (match.startOffset >= a.startOffset && match.startOffset < a.endOffset) ||
           (match.endOffset > a.startOffset && match.endOffset <= a.endOffset)
    );
    if (!overlapsAnnotation) {
      ranges.push({
        start: match.startOffset,
        end: match.endOffset,
        searchMatch: { ...match, index },
      });
    }
  });

  // Sort by start offset
  ranges.sort((a, b) => a.start - b.start);

  const segments: TextSegment[] = [];
  let currentPosition = 0;

  for (const range of ranges) {
    // Skip if this range overlaps with a previous one
    if (range.start < currentPosition) {
      continue;
    }

    // Add non-highlighted text before this range
    if (range.start > currentPosition) {
      segments.push({
        text: content.slice(currentPosition, range.start),
        start: currentPosition,
        end: range.start,
      });
    }

    // Add the highlighted text
    segments.push({
      text: content.slice(range.start, range.end),
      start: range.start,
      end: range.end,
      annotation: range.annotation,
      searchMatch: range.searchMatch,
    });

    currentPosition = range.end;
  }

  // Add any remaining non-highlighted text
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
  onMatchClick?: (matchIndex: number) => void;
}

function HighlightedText({
  segment,
  onAnnotationClick,
  onAnnotationEdit,
  onAnnotationDelete,
  onMatchClick,
}: HighlightedTextProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Plain text
  if (!segment.annotation && !segment.searchMatch) {
    return <>{segment.text}</>;
  }

  // Search match
  if (segment.searchMatch) {
    return (
      <span
        data-match-index={segment.searchMatch.index}
        className={cn(
          'cursor-pointer rounded-sm',
          segment.searchMatch.isSemanticMatch ? semanticMatchColor : searchMatchColor
        )}
        onClick={() => onMatchClick?.(segment.searchMatch!.index)}
      >
        {segment.text}
      </span>
    );
  }

  // Annotation
  const annotation = segment.annotation!;

  return (
    <StatuteAnnotationPopover
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
    </StatuteAnnotationPopover>
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

export function AnnotatableStatuteText({
  content,
  statuteId: _statuteId,
  annotations,
  searchMatches = [],
  hideRevisionHistory = false,
  onAnnotationCreate,
  onAnnotationClick,
  onAnnotationEdit,
  onAnnotationDelete,
  onMatchClick,
}: AnnotatableStatuteTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{
    startOffset: number;
    endOffset: number;
    selectedText: string;
  } | null>(null);

  // Optionally filter revision history and decode HTML entities
  const displayContent = useMemo(
    () => {
      let processed = hideRevisionHistory ? filterRevisionHistory(content) : content;
      processed = decodeHtmlEntities(processed);
      return processed;
    },
    [content, hideRevisionHistory]
  );

  // Build text segments with annotations and search matches
  const segments = useMemo(
    () => buildTextSegments(displayContent, annotations, searchMatches),
    [displayContent, annotations, searchMatches]
  );

  // Split content into lines with their start offsets for indentation
  const linesWithOffsets = useMemo(() => {
    const lines: { text: string; startOffset: number; endOffset: number; indentLevel: number }[] = [];
    let offset = 0;
    const splitLines = displayContent.split('\n');

    for (let i = 0; i < splitLines.length; i++) {
      const lineText = splitLines[i];
      const endOffset = offset + lineText.length;
      lines.push({
        text: lineText,
        startOffset: offset,
        endOffset: endOffset,
        indentLevel: getIndentLevel(lineText),
      });
      offset = endOffset + 1; // +1 for the newline character
    }
    return lines;
  }, [displayContent]);

  // Get segments for a specific line
  const getSegmentsForLine = useCallback((lineStart: number, lineEnd: number) => {
    return segments.filter(segment => {
      // Segment overlaps with this line
      return segment.start < lineEnd && segment.end > lineStart;
    }).map(segment => {
      // Clip segment to line boundaries
      const clippedStart = Math.max(segment.start, lineStart);
      const clippedEnd = Math.min(segment.end, lineEnd);
      const clippedText = displayContent.slice(clippedStart, clippedEnd);

      return {
        ...segment,
        text: clippedText,
        start: clippedStart,
        end: clippedEnd,
      };
    });
  }, [segments, displayContent]);

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

      // Find the text offset within the statute content
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
      <div
        ref={containerRef}
        className="font-mono text-sm"
        onContextMenu={handleContextMenu}
      >
        {linesWithOffsets.map((line, lineIndex) => {
          const lineSegments = getSegmentsForLine(line.startOffset, line.endOffset);

          return (
            <div
              key={lineIndex}
              className="leading-relaxed whitespace-pre-wrap"
              style={{ marginLeft: line.indentLevel > 0 ? `${line.indentLevel * 1.5}rem` : undefined }}
            >
              {lineSegments.length > 0 ? (
                lineSegments.map((segment, segIndex) => (
                  <HighlightedText
                    key={`${segment.start}-${segment.end}-${segIndex}`}
                    segment={segment}
                    onAnnotationClick={onAnnotationClick}
                    onAnnotationEdit={onAnnotationEdit}
                    onAnnotationDelete={onAnnotationDelete}
                    onMatchClick={onMatchClick}
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

// Export types and utilities
export { highlightColors, typeIcons };
