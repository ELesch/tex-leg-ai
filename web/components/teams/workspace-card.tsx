'use client';

import Link from 'next/link';
import { MessageSquare, StickyNote, Calendar, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WorkspaceStatus, WorkspacePriority } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';

interface WorkspaceCardProps {
  workspace: {
    id: string;
    billId: string;
    billDescription: string;
    status: WorkspaceStatus;
    priority: WorkspacePriority;
    dueDate: string | null;
    assigneeId?: string | null;
    assigneeName?: string | null;
    annotationCount: number;
    commentCount: number;
    updatedAt: string;
  };
  teamSlug: string;
}

const statusColors: Record<WorkspaceStatus, string> = {
  NEW: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  IN_REVIEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  NEEDS_DISCUSSION: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  ON_HOLD: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

const statusLabels: Record<WorkspaceStatus, string> = {
  NEW: 'New',
  IN_REVIEW: 'In Review',
  NEEDS_DISCUSSION: 'Needs Discussion',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ON_HOLD: 'On Hold',
};

const priorityColors: Record<WorkspacePriority, string> = {
  LOW: 'border-l-gray-400',
  MEDIUM: 'border-l-blue-400',
  HIGH: 'border-l-orange-400',
  URGENT: 'border-l-red-500',
};

export function WorkspaceCard({ workspace, teamSlug }: WorkspaceCardProps) {
  const updatedAgo = formatDistanceToNow(new Date(workspace.updatedAt), {
    addSuffix: true,
  });

  const isDueSoon =
    workspace.dueDate &&
    new Date(workspace.dueDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  return (
    <Link href={`/teams/${teamSlug}/bills/${workspace.billId}`}>
      <Card
        className={`hover:border-primary/50 transition-colors cursor-pointer border-l-4 ${
          priorityColors[workspace.priority]
        }`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base font-semibold">
              {workspace.billId}
            </CardTitle>
            <Badge className={statusColors[workspace.status]} variant="secondary">
              {statusLabels[workspace.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {workspace.billDescription}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              <span>{workspace.commentCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <StickyNote className="h-3 w-3" />
              <span>{workspace.annotationCount}</span>
            </div>
            {workspace.dueDate && (
              <div
                className={`flex items-center gap-1 ${
                  isDueSoon ? 'text-orange-600 dark:text-orange-400' : ''
                }`}
              >
                <Calendar className="h-3 w-3" />
                <span>
                  {new Date(workspace.dueDate).toLocaleDateString()}
                </span>
              </div>
            )}
            {workspace.assigneeName && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>{workspace.assigneeName}</span>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Updated {updatedAgo}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
