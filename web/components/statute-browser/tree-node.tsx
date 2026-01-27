'use client';

import { useCallback } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NodeType = 'code' | 'chapter' | 'subchapter' | 'section';

export interface TreeNodeData {
  id: string;
  type: NodeType;
  label: string;
  sublabel?: string;
  hasChildren: boolean;
  // For sections
  sectionNum?: string;
  codeAbbr?: string;
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
}: TreeNodeProps) {
  const isSection = node.type === 'section';
  const hasChildren = node.hasChildren && !isSection;

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
    <div className="select-none">
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

        {/* Node label */}
        <div className="flex-1 min-w-0 truncate">
          <span className="text-sm font-medium">{node.label}</span>
          {node.sublabel && (
            <span className="ml-1 text-xs text-muted-foreground truncate">
              {node.sublabel}
            </span>
          )}
        </div>
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
