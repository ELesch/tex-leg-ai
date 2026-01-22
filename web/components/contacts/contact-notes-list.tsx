'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Edit2, Plus, Trash2, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface NoteUser {
  id: string;
  name: string | null;
  email: string;
}

interface NoteMention {
  type: 'bill' | 'author' | 'contact';
  id: string;
  displayText: string;
}

interface ContactNote {
  id: string;
  content: string;
  mentions: NoteMention[] | null;
  createdAt: string;
  updatedAt: string;
  user: NoteUser;
}

interface ContactNotesListProps {
  notes: ContactNote[];
  onAddNote?: () => void;
  onEditNote?: (noteId: string) => void;
  onDeleteNote?: (noteId: string) => void;
  className?: string;
  emptyMessage?: string;
  showAddButton?: boolean;
}

// Render note content with clickable @-mentions
function renderNoteContent(content: string, mentions: NoteMention[] | null) {
  if (!mentions || mentions.length === 0) {
    return <span>{content}</span>;
  }

  // Match @[displayText](type:id) format
  const mentionRegex = /@\[([^\]]+)\]\((\w+):([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    const [, displayText, type, id] = match;
    const href = getMentionHref(type, id);

    parts.push(
      <Link
        key={`${type}-${id}-${match.index}`}
        href={href}
        className="text-primary hover:underline font-medium"
        onClick={(e) => e.stopPropagation()}
      >
        @{displayText}
      </Link>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return <>{parts}</>;
}

function getMentionHref(type: string, id: string): string {
  switch (type) {
    case 'bill':
      return `/bills/${id}`;
    case 'author':
      return `/authors/${encodeURIComponent(id)}`;
    case 'contact':
      return `/contacts/${id}`;
    default:
      return '#';
  }
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return email.charAt(0).toUpperCase();
}

export function ContactNotesList({
  notes,
  onAddNote,
  onEditNote,
  onDeleteNote,
  className,
  emptyMessage = 'No notes yet',
  showAddButton = true,
}: ContactNotesListProps) {
  if (notes.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground mb-4">{emptyMessage}</p>
          {showAddButton && onAddNote && (
            <Button variant="outline" size="sm" onClick={onAddNote}>
              <Plus className="h-4 w-4 mr-1" />
              Add Note
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Notes</CardTitle>
          {showAddButton && onAddNote && (
            <Button variant="ghost" size="sm" onClick={onAddNote} className="h-7">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {notes.map((note) => (
          <div
            key={note.id}
            className="p-3 rounded-md border bg-card"
          >
            <div className="flex items-start gap-3">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="text-xs">
                  {getInitials(note.user.name, note.user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {note.user.name || note.user.email}
                    </span>
                    <span>
                      {formatDistanceToNow(new Date(note.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {onEditNote && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onEditNote(note.id)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    )}
                    {onDeleteNote && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => onDeleteNote(note.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-sm mt-1 whitespace-pre-wrap break-words">
                  {renderNoteContent(note.content, note.mentions)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
