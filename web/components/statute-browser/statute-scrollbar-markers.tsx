'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface ScrollbarMarker {
  position: number; // 0-1 percentage position in content
  type: 'keyword' | 'semantic' | 'annotation';
  id?: string;
}

interface StatuteScrollbarMarkersProps {
  markers: ScrollbarMarker[];
  contentHeight: number;
  viewportHeight: number;
  scrollTop: number;
  onMarkerClick?: (marker: ScrollbarMarker) => void;
  className?: string;
}

const markerColors: Record<ScrollbarMarker['type'], string> = {
  keyword: 'bg-amber-400 hover:bg-amber-500',
  semantic: 'bg-purple-400 hover:bg-purple-500',
  annotation: 'bg-blue-400 hover:bg-blue-500',
};

export function StatuteScrollbarMarkers({
  markers,
  contentHeight,
  viewportHeight,
  scrollTop,
  onMarkerClick,
  className,
}: StatuteScrollbarMarkersProps) {
  // Calculate visible range indicator
  const visibleRatio = viewportHeight / contentHeight;
  const scrollRatio = scrollTop / (contentHeight - viewportHeight);
  const thumbHeight = Math.max(visibleRatio * 100, 5); // Minimum 5%
  const thumbTop = scrollRatio * (100 - thumbHeight);

  // Group markers that are very close together
  const groupedMarkers = useMemo(() => {
    if (markers.length === 0) return [];

    const sorted = [...markers].sort((a, b) => a.position - b.position);
    const groups: { position: number; markers: ScrollbarMarker[] }[] = [];
    let currentGroup: ScrollbarMarker[] = [];
    let lastPosition = -1;

    for (const marker of sorted) {
      // If within 1% of last marker, group them
      if (lastPosition >= 0 && marker.position - lastPosition < 0.01) {
        currentGroup.push(marker);
      } else {
        if (currentGroup.length > 0) {
          const avgPosition = currentGroup.reduce((sum, m) => sum + m.position, 0) / currentGroup.length;
          groups.push({ position: avgPosition, markers: currentGroup });
        }
        currentGroup = [marker];
      }
      lastPosition = marker.position;
    }

    if (currentGroup.length > 0) {
      const avgPosition = currentGroup.reduce((sum, m) => sum + m.position, 0) / currentGroup.length;
      groups.push({ position: avgPosition, markers: currentGroup });
    }

    return groups;
  }, [markers]);

  if (markers.length === 0) return null;

  return (
    <div
      className={cn(
        'absolute right-0 top-0 bottom-0 w-3 bg-muted/30 rounded-r',
        className
      )}
    >
      {/* Visible area indicator */}
      <div
        className="absolute right-0.5 w-2 bg-muted-foreground/20 rounded"
        style={{
          top: `${thumbTop}%`,
          height: `${thumbHeight}%`,
        }}
      />

      {/* Markers */}
      {groupedMarkers.map((group, index) => {
        // Determine primary marker type for color
        const primaryType = group.markers.find(m => m.type === 'semantic')?.type
          || group.markers.find(m => m.type === 'annotation')?.type
          || 'keyword';

        return (
          <button
            key={index}
            className={cn(
              'absolute right-0.5 w-2 h-1 rounded-sm cursor-pointer transition-colors',
              markerColors[primaryType]
            )}
            style={{ top: `${group.position * 100}%` }}
            onClick={() => {
              const firstMarker = group.markers[0];
              onMarkerClick?.(firstMarker);
            }}
            title={
              group.markers.length > 1
                ? `${group.markers.length} matches`
                : `${primaryType} match`
            }
          />
        );
      })}
    </div>
  );
}

/**
 * Calculate marker positions from search matches in text
 */
export function calculateMarkerPositions(
  matches: { startOffset: number; endOffset: number; isSemanticMatch?: boolean }[],
  totalTextLength: number
): ScrollbarMarker[] {
  return matches.map((match, index) => ({
    position: match.startOffset / totalTextLength,
    type: match.isSemanticMatch ? 'semantic' : 'keyword',
    id: `match-${index}`,
  }));
}

/**
 * Calculate marker positions from annotations
 */
export function calculateAnnotationMarkerPositions(
  annotations: { id: string; startOffset: number }[],
  totalTextLength: number
): ScrollbarMarker[] {
  return annotations.map(annotation => ({
    position: annotation.startOffset / totalTextLength,
    type: 'annotation',
    id: annotation.id,
  }));
}
