'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  MessageSquare,
  MoreVertical,
  Pencil,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChatSessionSummary {
  id: string;
  title: string;
  codeAbbr: string;
  chapterNum: string;
  subchapter: string | null;
  bill: { billId: string; description: string } | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface StatuteChatSessionListProps {
  sessions: ChatSessionSummary[];
  isLoading: boolean;
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  className?: string;
}

export function StatuteChatSessionList({
  sessions,
  isLoading,
  selectedSessionId,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  className,
}: StatuteChatSessionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStartEdit = useCallback((session: ChatSessionSummary) => {
    setEditingId(session.id);
    setEditTitle(session.title);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editTitle.trim()) return;
    setIsUpdating(true);
    try {
      await onRenameSession(editingId, editTitle.trim());
    } finally {
      setEditingId(null);
      setEditTitle('');
      setIsUpdating(false);
    }
  }, [editingId, editTitle, onRenameSession]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditTitle('');
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    setIsUpdating(true);
    try {
      await onDeleteSession(deleteConfirmId);
    } finally {
      setDeleteConfirmId(null);
      setIsUpdating(false);
    }
  }, [deleteConfirmId, onDeleteSession]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className={cn('text-center py-8 text-sm text-muted-foreground', className)}>
        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No previous chats</p>
        <p className="text-xs mt-1">Start a new chat above</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className={cn('h-full', className)}>
        <div className="space-y-1 p-1">
          {sessions.map(session => (
            <div
              key={session.id}
              className={cn(
                'group flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors',
                selectedSessionId === session.id
                  ? 'bg-accent'
                  : 'hover:bg-accent/50'
              )}
              onClick={() => onSelectSession(session.id)}
            >
              <MessageSquare className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />

              <div className="flex-1 min-w-0">
                {editingId === session.id ? (
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <Input
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      className="h-7 text-sm"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={handleSaveEdit}
                      disabled={isUpdating}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={handleCancelEdit}
                      disabled={isUpdating}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium truncate">{session.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {session.bill && (
                        <Badge variant="secondary" className="text-xs h-4 px-1">
                          {session.bill.billId}
                        </Badge>
                      )}
                      <span>{session.messageCount} msgs</span>
                      <span>{formatDate(session.updatedAt)}</span>
                    </div>
                  </>
                )}
              </div>

              {editingId !== session.id && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStartEdit(session); }}>
                      <Pencil className="h-3 w-3 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(session.id); }}
                    >
                      <Trash2 className="h-3 w-3 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this chat and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isUpdating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
