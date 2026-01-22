'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useMentionsSearch, parseMentions, createMentionMarkup, type MentionResult } from '@/hooks/use-mentions';
import { Loader2, AtSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NoteFormProps {
  open: boolean;
  onClose: () => void;
  authorId: string;
  noteId?: string | null;
  existingNotes: Array<{
    id: string;
    content: string;
    mentions: Array<{ type: string; id: string; displayText: string }> | null;
  }>;
  contactId?: string;
}

export function NoteForm({
  open,
  onClose,
  authorId,
  noteId,
  existingNotes,
  contactId,
}: NoteFormProps) {
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [content, setContent] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStartIndex, setMentionStartIndex] = useState<number>(0);
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  const { mentions, isLoading: isLoadingMentions } = useMentionsSearch(mentionQuery);

  const isEditing = !!noteId;

  // Load existing note content when editing
  useEffect(() => {
    if (open && noteId) {
      const existingNote = existingNotes.find((n) => n.id === noteId);
      if (existingNote) {
        setContent(existingNote.content);
      }
    } else if (open) {
      setContent('');
    }
  }, [open, noteId, existingNotes]);

  // Handle mention detection
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart;

    setContent(value);

    // Check for @ mentions
    const textBeforeCursor = value.slice(0, cursorPosition);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      setMentionQuery(atMatch[1] || '');
      setMentionStartIndex(cursorPosition - atMatch[0].length);
      setShowMentionPopover(true);
      setSelectedMentionIndex(0);
    } else {
      setMentionQuery(null);
      setShowMentionPopover(false);
    }
  };

  const insertMention = useCallback(
    (mention: MentionResult) => {
      const beforeMention = content.slice(0, mentionStartIndex);
      const afterMention = content.slice(
        mentionStartIndex + (mentionQuery?.length || 0) + 1
      );
      const mentionMarkup = createMentionMarkup(
        mention.type,
        mention.id,
        mention.displayText
      );
      const newContent = beforeMention + mentionMarkup + ' ' + afterMention;

      setContent(newContent);
      setShowMentionPopover(false);
      setMentionQuery(null);

      // Focus and set cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = beforeMention.length + mentionMarkup.length + 1;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    },
    [content, mentionStartIndex, mentionQuery]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMentionPopover || mentions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          prev < mentions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          prev > 0 ? prev - 1 : mentions.length - 1
        );
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        insertMention(mentions[selectedMentionIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        setShowMentionPopover(false);
        setMentionQuery(null);
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      toast({
        title: 'Validation error',
        description: 'Note content is required.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Parse mentions from content
      const mentions = parseMentions(content);

      const baseUrl = contactId
        ? `/api/contacts/${contactId}/notes`
        : `/api/user-contacts/${authorId}/notes`;

      if (isEditing) {
        // Update existing note
        const res = await fetch(baseUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            noteId,
            content: content.trim(),
            mentions: mentions.length > 0 ? mentions : null,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update note');
        }
      } else {
        // Create new note
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: content.trim(),
            mentions: mentions.length > 0 ? mentions : null,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create note');
        }
      }

      toast({
        title: isEditing ? 'Note updated' : 'Note added',
        description: isEditing
          ? 'The note has been updated.'
          : 'The note has been added.',
      });

      setContent('');
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save note',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Note' : 'Add Note'}</DialogTitle>
          <DialogDescription>
            Use @ to mention bills, legislators, or contacts
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              placeholder="Write a note... Use @ to mention bills or people"
              rows={6}
              className="resize-none"
            />

            {/* Mention popover */}
            {showMentionPopover && (
              <div className="absolute bottom-full left-0 mb-1 w-full max-h-48 overflow-y-auto rounded-md border bg-popover p-1 shadow-md z-50">
                {isLoadingMentions ? (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : mentions.length === 0 ? (
                  <div className="py-2 px-3 text-sm text-muted-foreground">
                    {mentionQuery
                      ? 'No results found'
                      : 'Type to search bills, legislators, or contacts'}
                  </div>
                ) : (
                  mentions.map((mention, index) => (
                    <button
                      key={`${mention.type}-${mention.id}`}
                      type="button"
                      className={cn(
                        'flex w-full items-start gap-2 rounded px-3 py-2 text-left text-sm',
                        index === selectedMentionIndex
                          ? 'bg-accent'
                          : 'hover:bg-accent/50'
                      )}
                      onClick={() => insertMention(mention)}
                    >
                      <MentionTypeIcon type={mention.type} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {mention.displayText}
                        </div>
                        {mention.subtext && (
                          <div className="text-xs text-muted-foreground truncate">
                            {mention.subtext}
                          </div>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AtSign className="h-3 w-3" />
            <span>Tip: Type @ to mention a bill (e.g., @HB 123), legislator, or contact</span>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !content.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Add Note'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MentionTypeIcon({ type }: { type: 'bill' | 'author' | 'contact' }) {
  const className = 'h-4 w-4 shrink-0 text-muted-foreground';

  switch (type) {
    case 'bill':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
        </svg>
      );
    case 'author':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
        </svg>
      );
    case 'contact':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
        </svg>
      );
  }
}
