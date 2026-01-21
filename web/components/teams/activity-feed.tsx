'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  MessageSquare,
  StickyNote,
  UserPlus,
  UserMinus,
  ArrowRightLeft,
  MessageCircle,
  Loader2,
} from 'lucide-react';
import { ActivityType } from '@prisma/client';

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface Activity {
  id: string;
  type: ActivityType;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: User | null;
}

interface ActivityFeedProps {
  teamId: string;
  maxHeight?: string;
}

const activityIcons: Record<ActivityType, typeof FileText> = {
  WORKSPACE_CREATED: FileText,
  STATUS_CHANGED: ArrowRightLeft,
  ANNOTATION_ADDED: StickyNote,
  COMMENT_ADDED: MessageSquare,
  CHAT_MESSAGE: MessageCircle,
  MEMBER_JOINED: UserPlus,
  MEMBER_LEFT: UserMinus,
};

function getActivityMessage(activity: Activity): string {
  const metadata = activity.metadata as Record<string, unknown> | null;

  switch (activity.type) {
    case 'WORKSPACE_CREATED':
      return `added ${metadata?.billId || 'a bill'} to the workspace`;

    case 'STATUS_CHANGED':
      return `changed status from ${metadata?.oldStatus || 'unknown'} to ${metadata?.newStatus || 'unknown'} on ${metadata?.billId || 'a bill'}`;

    case 'ANNOTATION_ADDED':
      return `added an annotation on ${metadata?.billId || 'a bill'}`;

    case 'COMMENT_ADDED':
      if (metadata?.isReply) {
        return `replied to a comment on ${metadata?.billId || 'a bill'}`;
      }
      return `commented on ${metadata?.billId || 'a bill'}`;

    case 'CHAT_MESSAGE':
      return `sent a message in team chat on ${metadata?.billId || 'a bill'}`;

    case 'MEMBER_JOINED':
      if (metadata?.action === 'created') {
        return 'created the team';
      }
      if (metadata?.joinedViaInvitation) {
        return `joined the team as ${metadata?.role || 'member'}`;
      }
      return `was added to the team as ${metadata?.role || 'member'}`;

    case 'MEMBER_LEFT':
      if (metadata?.action === 'left') {
        return 'left the team';
      }
      return 'was removed from the team';

    default:
      return 'performed an action';
  }
}

function ActivityItem({ activity }: { activity: Activity }) {
  const Icon = activityIcons[activity.type] || FileText;
  const timeAgo = formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true });
  const message = getActivityMessage(activity);

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

  return (
    <div className="flex gap-3 py-3">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={activity.user?.image || undefined} />
        <AvatarFallback className="text-xs">
          {activity.user
            ? getInitials(activity.user.name, activity.user.email)
            : '?'}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">
            {activity.user?.name || activity.user?.email || 'Unknown user'}
          </span>{' '}
          <span className="text-muted-foreground">{message}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{timeAgo}</p>
      </div>

      <div className="flex-shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

export function ActivityFeed({ teamId, maxHeight = '400px' }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const fetchActivities = async (loadMore = false) => {
    if (loadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const params = new URLSearchParams({ limit: '20' });
      if (loadMore && cursor) {
        params.set('cursor', cursor);
      }

      const response = await fetch(`/api/teams/${teamId}/activities?${params}`);
      if (!response.ok) throw new Error('Failed to fetch activities');

      const data = await response.json();

      if (loadMore) {
        setActivities((prev) => [...prev, ...data.activities]);
      } else {
        setActivities(data.activities);
      }

      setHasMore(data.hasMore);
      setCursor(data.nextCursor);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [teamId]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No activity yet
      </p>
    );
  }

  return (
    <div>
      <ScrollArea style={{ maxHeight }} className="pr-4">
        <div className="divide-y">
          {activities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
        </div>

        {hasMore && (
          <div className="py-4 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchActivities(true)}
              disabled={isLoadingMore}
            >
              {isLoadingMore && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Load more
            </Button>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
