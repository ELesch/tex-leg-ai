'use client';

import * as React from 'react';
import { Copy, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface TextSelectionContextMenuProps {
  children: React.ReactNode;
  billId: string;
  onAddNote?: (selectedText: string, startOffset: number, endOffset: number) => void;
}

interface MenuPosition {
  x: number;
  y: number;
}

interface SelectionData {
  text: string;
  startOffset: number;
  endOffset: number;
}

export function TextSelectionContextMenu({
  children,
  billId,
  onAddNote,
}: TextSelectionContextMenuProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = React.useState(false);
  const [position, setPosition] = React.useState<MenuPosition>({ x: 0, y: 0 });
  const [selection, setSelection] = React.useState<SelectionData | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const getSelectionData = React.useCallback((): SelectionData | null => {
    const windowSelection = window.getSelection();
    if (!windowSelection || windowSelection.isCollapsed) {
      return null;
    }

    const selectedText = windowSelection.toString().trim();
    if (!selectedText) {
      return null;
    }

    // Check if selection is within our container
    if (!containerRef.current) {
      return null;
    }

    const range = windowSelection.getRangeAt(0);
    const containerNode = containerRef.current;

    // Check if the selection is within the container
    if (
      !containerNode.contains(range.startContainer) ||
      !containerNode.contains(range.endContainer)
    ) {
      return null;
    }

    // Calculate offsets relative to the container's text content
    const preSelectionRange = document.createRange();
    preSelectionRange.selectNodeContents(containerNode);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preSelectionRange.toString().length;

    const endOffset = startOffset + selectedText.length;

    return {
      text: selectedText,
      startOffset,
      endOffset,
    };
  }, []);

  const handleContextMenu = React.useCallback(
    (e: React.MouseEvent) => {
      const selectionData = getSelectionData();

      if (selectionData) {
        e.preventDefault();
        setSelection(selectionData);
        setPosition({ x: e.clientX, y: e.clientY });
        setIsOpen(true);
      }
    },
    [getSelectionData]
  );

  const handleClose = React.useCallback(() => {
    setIsOpen(false);
    setSelection(null);
  }, []);

  // Close menu when clicking outside
  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    // Close on scroll
    const handleScroll = () => {
      handleClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, handleClose]);

  const handleCopy = React.useCallback(async () => {
    if (!selection) return;

    try {
      await navigator.clipboard.writeText(selection.text);
      toast({
        title: 'Copied',
        description: 'Selected text copied to clipboard',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy text',
        variant: 'destructive',
      });
    }
    handleClose();
  }, [selection, toast, handleClose]);

  const handleAddNote = React.useCallback(async () => {
    if (!selection) return;

    try {
      const response = await fetch(`/api/bills/${encodeURIComponent(billId)}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: selection.text,
          sourceType: 'MANUAL',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save note');
      }

      toast({
        title: 'Note added',
        description: 'Selected text has been added to your notes',
      });

      onAddNote?.(selection.text, selection.startOffset, selection.endOffset);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add note',
        variant: 'destructive',
      });
    }
    handleClose();
  }, [billId, selection, toast, onAddNote, handleClose]);

  // Adjust menu position to stay within viewport
  const getAdjustedPosition = React.useCallback(() => {
    if (!menuRef.current) return position;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let { x, y } = position;

    // Adjust horizontal position
    if (x + rect.width > viewportWidth) {
      x = viewportWidth - rect.width - 8;
    }

    // Adjust vertical position
    if (y + rect.height > viewportHeight) {
      y = viewportHeight - rect.height - 8;
    }

    return { x: Math.max(8, x), y: Math.max(8, y) };
  }, [position]);

  const adjustedPosition = isOpen ? getAdjustedPosition() : position;

  return (
    <>
      <div ref={containerRef} onContextMenu={handleContextMenu}>
        {children}
      </div>

      {isOpen && selection && (
        <div
          ref={menuRef}
          className={cn(
            'fixed z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
            'animate-in fade-in-0 zoom-in-95'
          )}
          style={{
            left: adjustedPosition.x,
            top: adjustedPosition.y,
          }}
        >
          <div className="px-2 py-1.5 text-xs text-muted-foreground border-b mb-1">
            {selection.text.length > 50
              ? `"${selection.text.substring(0, 50)}..."`
              : `"${selection.text}"`}
          </div>
          <button
            type="button"
            onClick={handleAddNote}
            className={cn(
              'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
              'transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground'
            )}
          >
            <StickyNote className="mr-2 h-4 w-4" />
            Add Note
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
              'transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground'
            )}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </button>
        </div>
      )}
    </>
  );
}
