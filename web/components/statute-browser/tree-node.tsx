'use client';

import { useCallback, useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, Loader2, Flag, MoreHorizontal, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export type NodeType = 'code' | 'chapter' | 'subchapter' | 'section';
export type MarkerColor = 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'BLUE' | 'PURPLE';

export interface TreeNodeData {
  id: string;
  type: NodeType;
  label: string;
  sublabel?: string;
  hasChildren: boolean;
  // For sections
  sectionNum?: string;
  codeAbbr?: string;
  // For chapters and subchapters
  chapterNum?: string;
  subchapter?: string;
}

export interface MarkerData {
  id: string;
  color: MarkerColor;
  label?: string;
}

interface TreeNodeProps {
  node: TreeNodeData;
  level: number;
  isExpanded: boolean;
  isSelected: boolean;
  isLoading: boolean;
  onToggle: () => void;
  onSelect: () => void;
  children?: React.ReactNode;
  marker?: MarkerData;
  onAddMarker?: (color: MarkerColor) => void;
  onRemoveMarker?: () => void;
}

const MARKER_COLORS: { color: MarkerColor; label: string; className: string }[] = [
  { color: 'RED', label: 'Red', className: 'bg-red-500' },
  { color: 'ORANGE', label: 'Orange', className: 'bg-orange-500' },
  { color: 'YELLOW', label: 'Yellow', className: 'bg-yellow-500' },
  { color: 'GREEN', label: 'Green', className: 'bg-green-500' },
  { color: 'BLUE', label: 'Blue', className: 'bg-blue-500' },
  { color: 'PURPLE', label: 'Purple', className: 'bg-purple-500' },
];

export function getMarkerColorClass(color: MarkerColor): string {
  const found = MARKER_COLORS.find(c => c.color === color);
  return found?.className || 'bg-yellow-500';
}

export function TreeNode({
  node,
  level,
  isExpanded,
  isSelected,
  isLoading,
  onToggle,
  onSelect,
  children,
  marker,
  onAddMarker,
  onRemoveMarker,
}: TreeNodeProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isSection = node.type === 'section';
  const hasChildren = node.hasChildren && !isSection;
  const canHaveMarker = node.type !== 'section'; // Markers only on code/chapter/subchapter

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSection) {
      onSelect();
    } else if (hasChildren) {
      onToggle();
    }
  }, [isSection, hasChildren, onSelect, onToggle]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isSection) {
        onSelect();
      } else if (hasChildren) {
        onToggle();
      }
    } else if (e.key === 'ArrowRight' && hasChildren && !isExpanded) {
      e.preventDefault();
      onToggle();
    } else if (e.key === 'ArrowLeft' && hasChildren && isExpanded) {
      e.preventDefault();
      onToggle();
    }
  }, [isSection, hasChildren, isExpanded, onSelect, onToggle]);

  const Icon = isSection
    ? FileText
    : isExpanded
      ? FolderOpen
      : Folder;

  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

  return (
    <div className="select-none group">
      <div
        role="treeitem"
        tabIndex={0}
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isSelected}
        className={cn(
          'flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer',
          'hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
          isSelected && 'bg-accent text-accent-foreground',
          'transition-colors'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {/* Expand/collapse chevron */}
        {hasChildren ? (
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : (
              <ChevronIcon className="h-3 w-3 text-muted-foreground" />
            )}
          </span>
        ) : (
          <span className="w-4" />
        )}

        {/* Node icon */}
        <Icon className={cn(
          'h-4 w-4 shrink-0',
          isSection ? 'text-blue-500' : 'text-amber-500'
        )} />

        {/* Marker indicator */}
        {marker && (
          <span
            className={cn(
              'w-2.5 h-2.5 rounded-full shrink-0',
              getMarkerColorClass(marker.color)
            )}
            title={marker.label || `${marker.color} marker`}
          />
        )}

        {/* Node label */}
        <div className="flex-1 min-w-0 truncate">
          <span className="text-sm font-medium">{node.label}</span>
          {node.sublabel && (
            <span className="ml-1 text-xs text-muted-foreground truncate">
              {node.sublabel}
            </span>
          )}
        </div>

        {/* Context menu for markers */}
        {canHaveMarker && (onAddMarker || onRemoveMarker) && (
          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button
                className={cn(
                  'p-1 rounded hover:bg-accent/50 opacity-0 group-hover:opacity-100 transition-opacity',
                  isMenuOpen && 'opacity-100'
                )}
              >
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {onAddMarker && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Flag className="mr-2 h-4 w-4" />
                    {marker ? 'Change marker' : 'Add marker'}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {MARKER_COLORS.map(({ color, label, className }) => (
                      <DropdownMenuItem
                        key={color}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddMarker(color);
                          setIsMenuOpen(false);
                        }}
                      >
                        <span className={cn('w-3 h-3 rounded-full mr-2', className)} />
                        {label}
                        {marker?.color === color && (
                          <span className="ml-auto text-xs text-muted-foreground">✓</span>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {marker && onRemoveMarker && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveMarker();
                      setIsMenuOpen(false);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove marker
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Children */}
      {isExpanded && children && (
        <div role="group" className="animate-in slide-in-from-top-1 duration-150">
          {children}
        </div>
      )}
    </div>
  );
}
