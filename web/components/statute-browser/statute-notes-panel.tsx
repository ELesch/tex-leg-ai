'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { StickyNote, Trash2, Edit2, Plus, Loader2, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatDistanceToNow } from 'date-fns';

interface Note {
  id: string;
  codeAbbr: string;
  chapterNum: string | null;
  subchapter: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface StatuteNotesPanelProps {
  codeAbbr?: string;
  chapterNum?: string | null;
  subchapter?: string | null;
  onNavigateToNote?: (codeAbbr: string, chapterNum?: string, subchapter?: string) => void;
}

export function StatuteNotesPanel({
  codeAbbr,
  chapterNum,
  subchapter,
  onNavigateToNote,
}: StatuteNotesPanelProps) {
  const { data: session } = useSession();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch notes
  const fetchNotes = useCallback(async () => {
    if (!session?.user) {
      setNotes([]);
      setIsLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (codeAbbr) params.set('codeAbbr', codeAbbr);
      if (chapterNum) params.set('chapterNum', chapterNum);
      if (subchapter) params.set('subchapter', subchapter);

      const response = await fetch(`/api/statutes/notes?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setNotes(data.notes);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user, codeAbbr, chapterNum, subchapter]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Create a note
  const handleCreate = async () => {
    if (!noteContent.trim() || !codeAbbr) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/statutes/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeAbbr,
          chapterNum: chapterNum || null,
          subchapter: subchapter || null,
          content: noteContent.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setNotes(prev => [data.note, ...prev]);
        setNoteContent('');
        setIsCreating(false);
      }
    } catch (error) {
      console.error('Error creating note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Update a note
  const handleUpdate = async () => {
    if (!editingNote || !noteContent.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/statutes/notes/${editingNote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: noteContent.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setNotes(prev => prev.map(n =>
          n.id === editingNote.id ? data.note : n
        ));
        setEditingNote(null);
        setNoteContent('');
      }
    } catch (error) {
      console.error('Error updating note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete a note
  const handleDelete = async (note: Note) => {
    try {
      const response = await fetch(`/api/statutes/notes/${note.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotes(prev => prev.filter(n => n.id !== note.id));
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  // Open edit dialog
  const openEditDialog = (note: Note) => {
    setEditingNote(note);
    setNoteContent(note.content);
  };

  // Get display location for a note
  const getNoteLocation = (note: Note): string => {
    let location = note.codeAbbr;
    if (note.chapterNum) {
      location += ` Ch. ${note.chapterNum}`;
    }
    if (note.subchapter) {
      location += ` Subch. ${note.subchapter}`;
    }
    return location;
  };

  // Get current location description
  const getCurrentLocation = (): string => {
    if (!codeAbbr) return 'All notes';
    let location = codeAbbr;
    if (chapterNum) location += ` Ch. ${chapterNum}`;
    if (subchapter) location += ` Subch. ${subchapter}`;
    return location;
  };

  if (!session?.user) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        <StickyNote className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
        <p>Sign in to save notes</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 p-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="font-semibold">Notes</h2>
              <div className="text-xs text-muted-foreground">
                {getCurrentLocation()}
              </div>
            </div>
          </div>
          {codeAbbr && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsCreating(true);
                setNoteContent('');
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>
      </div>

      {/* Create note inline */}
      {isCreating && (
        <div className="flex-shrink-0 p-3 border-b bg-muted/30">
          <Textarea
            placeholder="Write your note..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            className="min-h-[80px] mb-2"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsCreating(false);
                setNoteContent('');
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!noteContent.trim() || isSaving}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-2">
          {notes.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <StickyNote className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p>No notes yet</p>
              {codeAbbr && (
                <p className="text-xs mt-1">
                  Click "Add" to create a note for this location
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {notes.map(note => (
                <div
                  key={note.id}
                  className="p-3 rounded-md border bg-card hover:bg-accent/30 group"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      onClick={() => onNavigateToNote?.(
                        note.codeAbbr,
                        note.chapterNum || undefined,
                        note.subchapter || undefined
                      )}
                    >
                      {getNoteLocation(note)}
                      <ChevronRight className="h-3 w-3" />
                    </button>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => openEditDialog(note)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(note)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap line-clamp-4">
                    {note.content}
                  </p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Edit Dialog */}
      <Dialog open={!!editingNote} onOpenChange={(open) => !open && setEditingNote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <div className="text-sm text-muted-foreground">
                {editingNote && getNoteLocation(editingNote)}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Note</label>
              <Textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="min-h-[120px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingNote(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={!noteContent.trim() || isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
