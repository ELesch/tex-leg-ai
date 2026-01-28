'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  StickyNote,
  HelpCircle,
  AlertTriangle,
  Highlighter,
  Check,
  X,
  Trash2,
  Loader2,
  Plus,
} from 'lucide-react';
import { AnnotationType } from '@prisma/client';

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface Annotation {
  id: string;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  content: string;
  type: AnnotationType;
  resolved: boolean;
  user: User;
  createdAt: string;
  updatedAt: string;
}

interface AnnotationPanelProps {
  teamId: string;
  billId: string;
  annotations: Annotation[];
  currentUserId: string;
  canAnnotate: boolean;
  canResolve: boolean;
  onAnnotationAdded: () => void;
  onAnnotationClick?: (annotation: Annotation) => void;
  onScrollToAnnotation?: (annotationId: string) => void;
  selectedAnnotation?: Annotation | null;
  showCreateForm?: boolean;
  pendingSelection?: {
    startOffset: number;
    endOffset: number;
    selectedText: string;
  } | null;
  onCancelCreate?: () => void;
}

const typeIcons: Record<AnnotationType, typeof StickyNote> = {
  NOTE: StickyNote,
  QUESTION: HelpCircle,
  CONCERN: AlertTriangle,
  HIGHLIGHT: Highlighter,
};

const typeColors: Record<AnnotationType, string> = {
  NOTE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  QUESTION: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  CONCERN: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  HIGHLIGHT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
};

const typeLabels: Record<AnnotationType, string> = {
  NOTE: 'Note',
  QUESTION: 'Question',
  CONCERN: 'Concern',
  HIGHLIGHT: 'Highlight',
};

function AnnotationItem({
  annotation,
  teamId,
  billId,
  currentUserId,
  canResolve,
  onUpdated,
  onClick,
  isSelected,
}: {
  annotation: Annotation;
  teamId: string;
  billId: string;
  currentUserId: string;
  canResolve: boolean;
  onUpdated: () => void;
  onClick?: () => void;
  isSelected?: boolean;
}) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const Icon = typeIcons[annotation.type];
  const isOwn = annotation.user.id === currentUserId;
  const timeAgo = formatDistanceToNow(new Date(annotation.createdAt), { addSuffix: true });

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  const handleResolve = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch(
        `/api/teams/${teamId}/workspaces/${billId}/annotations`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            annotationId: annotation.id,
            resolved: !annotation.resolved,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update annotation');
      }

      onUpdated();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this annotation?')) return;

    setIsUpdating(true);
    try {
      const response = await fetch(
        `/api/teams/${teamId}/workspaces/${billId}/annotations`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ annotationId: annotation.id }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete annotation');
      }

      toast({
        title: 'Annotation deleted',
        description: 'The annotation has been removed.',
      });
      onUpdated();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div
      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
        isSelected ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
      } ${annotation.resolved ? 'opacity-60' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <Badge className={typeColors[annotation.type]} variant="secondary">
          <Icon className="h-3 w-3 mr-1" />
          {typeLabels[annotation.type]}
        </Badge>
        {annotation.resolved && (
          <Badge variant="outline" className="text-green-600">
            <Check className="h-3 w-3 mr-1" />
            Resolved
          </Badge>
        )}
      </div>

      <div className="mt-2 text-xs bg-muted p-2 rounded italic line-clamp-2">
        &ldquo;{annotation.selectedText}&rdquo;
      </div>

      <p className="mt-2 text-sm">{annotation.content}</p>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar className="h-5 w-5">
            <AvatarImage src={annotation.user.image || undefined} />
            <AvatarFallback className="text-[10px]">
              {getInitials(annotation.user.name, annotation.user.email)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">
            {annotation.user.name || annotation.user.email} · {timeAgo}
          </span>
        </div>

        <div className="flex gap-1">
          {canResolve && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                handleResolve();
              }}
              disabled={isUpdating}
            >
              {annotation.resolved ? (
                <X className="h-3 w-3" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </Button>
          )}
          {isOwn && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              disabled={isUpdating}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AnnotationPanel({
  teamId,
  billId,
  annotations,
  currentUserId,
  canAnnotate,
  canResolve,
  onAnnotationAdded,
  onAnnotationClick,
  onScrollToAnnotation,
  selectedAnnotation,
  showCreateForm,
  pendingSelection,
  onCancelCreate,
}: AnnotationPanelProps) {
  const { toast } = useToast();
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<AnnotationType>('NOTE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unresolved'>('unresolved');

  const handleCreate = async () => {
    if (!pendingSelection || !newContent.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/teams/${teamId}/workspaces/${billId}/annotations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startOffset: pendingSelection.startOffset,
            endOffset: pendingSelection.endOffset,
            selectedText: pendingSelection.selectedText,
            content: newContent.trim(),
            type: newType,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create annotation');
      }

      setNewContent('');
      setNewType('NOTE');
      onCancelCreate?.();
      onAnnotationAdded();

      toast({
        title: 'Annotation added',
        description: 'Your annotation has been saved.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add annotation',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAnnotations = annotations.filter((a) =>
    filter === 'all' ? true : !a.resolved
  );

  const unresolvedCount = annotations.filter((a) => !a.resolved).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header with filter */}
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm">Annotations ({unresolvedCount})</h3>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unresolved">Unresolved</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Create form */}
      {showCreateForm && pendingSelection && canAnnotate && (
        <div className="p-3 border-b bg-muted/30 space-y-3">
          <div className="text-xs bg-muted p-2 rounded italic">
            &ldquo;{pendingSelection.selectedText.substring(0, 100)}
            {pendingSelection.selectedText.length > 100 ? '...' : ''}&rdquo;
          </div>

          <Select value={newType} onValueChange={(v) => setNewType(v as AnnotationType)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NOTE">Note</SelectItem>
              <SelectItem value="QUESTION">Question</SelectItem>
              <SelectItem value="CONCERN">Concern</SelectItem>
              <SelectItem value="HIGHLIGHT">Highlight</SelectItem>
            </SelectContent>
          </Select>

          <Textarea
            placeholder="Add your annotation..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
            className="text-sm"
          />

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={isSubmitting || !newContent.trim()}
            >
              {isSubmitting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              <Plus className="mr-1 h-3 w-3" />
              Add
            </Button>
            <Button size="sm" variant="outline" onClick={onCancelCreate}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Annotations list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {filteredAnnotations.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              {filter === 'unresolved'
                ? 'No unresolved annotations'
                : 'No annotations yet'}
              {canAnnotate && (
                <>
                  <br />
                  <span className="text-xs">
                    Select text in the bill to add an annotation
                  </span>
                </>
              )}
            </p>
          ) : (
            filteredAnnotations.map((annotation) => (
              <AnnotationItem
                key={annotation.id}
                annotation={annotation}
                teamId={teamId}
                billId={billId}
                currentUserId={currentUserId}
                canResolve={canResolve}
                onUpdated={onAnnotationAdded}
                onClick={() => {
                  onAnnotationClick?.(annotation);
                  onScrollToAnnotation?.(annotation.id);
                }}
                isSelected={selectedAnnotation?.id === annotation.id}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
