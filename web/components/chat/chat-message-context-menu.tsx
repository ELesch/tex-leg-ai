'use client';

import * as React from 'react';
import { Copy, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ChatMessageContextMenuProps {
  children: React.ReactNode;
  messageContent: string;
  billId: string;
  onSendToNotes?: () => void;
}

interface MenuPosition {
  x: number;
  y: number;
}

export function ChatMessageContextMenu({
  children,
  messageContent,
  billId,
  onSendToNotes,
}: ChatMessageContextMenuProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = React.useState(false);
  const [position, setPosition] = React.useState<MenuPosition>({ x: 0, y: 0 });
  const menuRef = React.useRef<HTMLDivElement>(null);

  const handleContextMenu = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setPosition({ x: e.clientX, y: e.clientY });
      setIsOpen(true);
    },
    []
  );

  const handleClose = React.useCallback(() => {
    setIsOpen(false);
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

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, handleClose]);

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(messageContent);
      toast({
        title: 'Copied',
        description: 'Message copied to clipboard',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy message',
        variant: 'destructive',
      });
    }
    handleClose();
  }, [messageContent, toast, handleClose]);

  const handleSendToNotes = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/bills/${encodeURIComponent(billId)}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: messageContent,
          sourceType: 'CHAT',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save note');
      }

      toast({
        title: 'Saved to notes',
        description: 'Message has been added to your notes',
      });

      onSendToNotes?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save note',
        variant: 'destructive',
      });
    }
    handleClose();
  }, [billId, messageContent, toast, onSendToNotes, handleClose]);

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
      <div onContextMenu={handleContextMenu}>{children}</div>

      {isOpen && (
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
          <button
            type="button"
            onClick={handleSendToNotes}
            className={cn(
              'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
              'transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground'
            )}
          >
            <StickyNote className="mr-2 h-4 w-4" />
            Send to Notes
          </button>
        </div>
      )}
    </>
  );
}
