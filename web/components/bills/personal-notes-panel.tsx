'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import { StickyNote, Pencil, Trash2, Plus, MessageSquare, LogIn } from 'lucide-react';

interface PersonalNote {
  id: string;
  content: string;
  sourceType: 'manual' | 'chat' | null;
  createdAt: string;
  updatedAt: string;
}

interface PersonalNotesPanelProps {
  billId: string;
}

export function PersonalNotesPanel({ billId }: PersonalNotesPanelProps) {
  const { data: session, status } = useSession();
  const { toast } = useToast();

  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  // Fetch notes on mount
  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      setIsLoading(false);
      return;
    }

    const fetchNotes = async () => {
      try {
        const response = await fetch(`/api/bills/${encodeURIComponent(billId)}/notes`);
        if (response.ok) {
          const data = await response.json();
          setNotes(data.notes || []);
        } else if (response.status !== 401) {
          throw new Error('Failed to fetch notes');
        }
      } catch (error) {
        console.error('Error fetching notes:', error);
        toast({
          title: 'Error',
          description: 'Failed to load notes. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotes();
  }, [billId, session, status, toast]);

  // Create a new note
  const handleCreateNote = async () => {
    if (!newNoteContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/bills/${encodeURIComponent(billId)}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNoteContent.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setNotes((prev) => [data.note, ...prev]);
        setNewNoteContent('');
        toast({
          title: 'Note added',
          description: 'Your note has been saved.',
        });
      } else {
        throw new Error('Failed to create note');
      }
    } catch (error) {
      console.error('Error creating note:', error);
      toast({
        title: 'Error',
        description: 'Failed to save note. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Start editing a note
  const handleStartEdit = (note: PersonalNote) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditContent('');
  };

  // Save edited note
  const handleSaveEdit = async () => {
    if (!editingNoteId || !editContent.trim() || isUpdating) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/bills/${encodeURIComponent(billId)}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: editingNoteId, content: editContent.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setNotes((prev) =>
          prev.map((note) => (note.id === editingNoteId ? data.note : note))
        );
        setEditingNoteId(null);
        setEditContent('');
        toast({
          title: 'Note updated',
          description: 'Your changes have been saved.',
        });
      } else {
        throw new Error('Failed to update note');
      }
    } catch (error) {
      console.error('Error updating note:', error);
      toast({
        title: 'Error',
        description: 'Failed to update note. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete a note
  const handleDeleteNote = async (noteId: string) => {
    setDeletingNoteId(noteId);
    try {
      const response = await fetch(`/api/bills/${encodeURIComponent(billId)}/notes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId }),
      });

      if (response.ok) {
        setNotes((prev) => prev.filter((note) => note.id !== noteId));
        toast({
          title: 'Note deleted',
          description: 'The note has been removed.',
        });
      } else {
        throw new Error('Failed to delete note');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete note. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingNoteId(null);
    }
  };

  // Show sign-in message if not authenticated
  if (status !== 'loading' && !session) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <StickyNote className="h-5 w-5" />
            Personal Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <LogIn className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Sign in to save personal notes for this bill.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <StickyNote className="h-5 w-5" />
            Personal Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <StickyNote className="h-5 w-5" />
          Personal Notes
          {notes.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {notes.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add note form */}
        <div className="space-y-2">
          <Textarea
            placeholder="Add a personal note about this bill..."
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            className="min-h-[80px] resize-none"
          />
          <Button
            onClick={handleCreateNote}
            disabled={!newNoteContent.trim() || isSubmitting}
            size="sm"
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Adding...' : 'Add Note'}
          </Button>
        </div>

        {/* Notes list */}
        {notes.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              No notes yet. Add your first note above.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-lg border bg-muted/30 p-3"
                >
                  {editingNoteId === note.id ? (
                    // Edit mode
                    <div className="space-y-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[80px] resize-none"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelEdit}
                          disabled={isUpdating}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={!editContent.trim() || isUpdating}
                        >
                          {isUpdating ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="whitespace-pre-wrap text-sm">
                            {note.content}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleStartEdit(note)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit note</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                disabled={deletingNoteId === note.id}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete note</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Note</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this note? This action
                                  cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        {note.sourceType === 'chat' && (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <MessageSquare className="h-3 w-3" />
                            From chat
                          </Badge>
                        )}
                        <span>
                          {note.updatedAt !== note.createdAt
                            ? `Updated ${formatDate(note.updatedAt)}`
                            : formatDate(note.createdAt)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
