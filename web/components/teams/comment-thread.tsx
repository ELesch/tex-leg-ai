'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Reply, Trash2, Loader2 } from 'lucide-react';

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface Comment {
  id: string;
  content: string;
  user: User;
  createdAt: string;
  updatedAt: string;
  replies?: Comment[];
}

interface CommentThreadProps {
  teamId: string;
  billId: string;
  comments: Comment[];
  currentUserId: string;
  canComment: boolean;
  onCommentAdded: () => void;
}

function CommentItem({
  comment,
  teamId,
  billId,
  currentUserId,
  canComment,
  onCommentAdded,
  isReply = false,
}: {
  comment: Comment;
  teamId: string;
  billId: string;
  currentUserId: string;
  canComment: boolean;
  onCommentAdded: () => void;
  isReply?: boolean;
}) {
  const { toast } = useToast();
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwn = comment.user.id === currentUserId;
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });

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

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/teams/${teamId}/workspaces/${billId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: replyContent.trim(),
            parentId: comment.id,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add reply');
      }

      setReplyContent('');
      setIsReplying(false);
      onCommentAdded();

      toast({
        title: 'Reply added',
        description: 'Your reply has been posted.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add reply',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/teams/${teamId}/workspaces/${billId}/comments`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commentId: comment.id }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete comment');
      }

      onCommentAdded();

      toast({
        title: 'Comment deleted',
        description: 'Your comment has been removed.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete comment',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={`${isReply ? 'ml-8 mt-3' : ''}`}>
      <div className="flex gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={comment.user.image || undefined} />
          <AvatarFallback className="text-xs">
            {getInitials(comment.user.name, comment.user.email)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {comment.user.name || comment.user.email}
            </span>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>

          <p className="mt-1 text-sm whitespace-pre-wrap">{comment.content}</p>

          <div className="mt-2 flex items-center gap-2">
            {canComment && !isReply && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setIsReplying(!isReplying)}
              >
                <Reply className="mr-1 h-3 w-3" />
                Reply
              </Button>
            )}
            {isOwn && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="mr-1 h-3 w-3" />
                )}
                Delete
              </Button>
            )}
          </div>

          {isReplying && (
            <div className="mt-3 space-y-2">
              <Textarea
                placeholder="Write a reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={2}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSubmitReply}
                  disabled={isSubmitting || !replyContent.trim()}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                  Reply
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsReplying(false);
                    setReplyContent('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="border-l-2 border-muted pl-4 mt-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              teamId={teamId}
              billId={billId}
              currentUserId={currentUserId}
              canComment={canComment}
              onCommentAdded={onCommentAdded}
              isReply
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CommentThread({
  teamId,
  billId,
  comments,
  currentUserId,
  canComment,
  onCommentAdded,
}: CommentThreadProps) {
  const { toast } = useToast();
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/teams/${teamId}/workspaces/${billId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newComment.trim() }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add comment');
      }

      setNewComment('');
      onCommentAdded();

      toast({
        title: 'Comment added',
        description: 'Your comment has been posted.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add comment',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* New comment form */}
      {canComment && (
        <div className="space-y-2">
          <Textarea
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !newComment.trim()}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <MessageSquare className="mr-2 h-4 w-4" />
              Comment
            </Button>
          </div>
        </div>
      )}

      {/* Comments list */}
      {comments.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              teamId={teamId}
              billId={billId}
              currentUserId={currentUserId}
              canComment={canComment}
              onCommentAdded={onCommentAdded}
            />
          ))}
        </div>
      )}
    </div>
  );
}
