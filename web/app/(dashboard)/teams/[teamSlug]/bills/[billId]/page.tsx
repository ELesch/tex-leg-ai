'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CommentThread } from '@/components/teams/comment-thread';
import { AnnotationPanel } from '@/components/teams/annotation-panel';
import { TeamChatPanel } from '@/components/teams/team-chat-panel';
import { AnnotatableBillText } from '@/components/teams/annotatable-bill-text';
import { WorkspaceStatusSelect, WorkspacePrioritySelect } from '@/components/teams/workspace-status';
import { WorkspaceSummary } from '@/components/teams/workspace-summary';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  MessageSquare,
  StickyNote,
  Bot,
  ExternalLink,
  Calendar,
  User,
  PanelRightClose,
  PanelRightOpen,
  ChevronRight,
} from 'lucide-react';
import { TeamRole, WorkspaceStatus, WorkspacePriority, AnnotationType } from '@prisma/client';

interface Bill {
  id: string;
  billId: string;
  billType: string;
  billNumber: number;
  description: string;
  content: string | null;
  status: string | null;
  authors: string[];
  subjects: string[];
  lastAction: string | null;
  lastActionDate: string | null;
  session: {
    code: string;
    name: string;
  };
}

interface WorkspaceUser {
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
  user: WorkspaceUser;
  createdAt: string;
  updatedAt: string;
}

interface Comment {
  id: string;
  content: string;
  user: WorkspaceUser;
  createdAt: string;
  updatedAt: string;
  replies?: Comment[];
}

interface Workspace {
  id: string;
  status: WorkspaceStatus;
  priority: WorkspacePriority;
  dueDate: string | null;
  summary: string | null;
  assignee: WorkspaceUser | null;
  annotationCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  bill: Bill;
  annotations: Annotation[];
  comments: Comment[];
}

export default function TeamWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();
  const teamSlug = params.teamSlug as string;
  const billId = params.billId as string;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<TeamRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Right panel visibility state
  const [showRightPanel, setShowRightPanel] = useState(true);

  // Annotation selection state
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<{
    startOffset: number;
    endOffset: number;
    selectedText: string;
  } | null>(null);

  const fetchWorkspace = useCallback(async () => {
    try {
      // Get team ID from slug
      const teamsResponse = await fetch('/api/teams');
      if (!teamsResponse.ok) throw new Error('Failed to fetch teams');
      const { teams } = await teamsResponse.json();
      const team = teams.find((t: { slug: string }) => t.slug === teamSlug);

      if (!team) {
        router.push('/teams');
        return;
      }

      setTeamId(team.id);
      setTeamName(team.name);

      const response = await fetch(`/api/teams/${team.id}/workspaces/${billId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: 'Workspace not found',
            description: 'This bill is not in the team workspace.',
            variant: 'destructive',
          });
          router.push(`/teams/${teamSlug}`);
          return;
        }
        throw new Error('Failed to fetch workspace');
      }

      const data = await response.json();
      setWorkspace(data.workspace);
      setCurrentUserRole(data.currentUserRole);
    } catch (error) {
      console.error('Error fetching workspace:', error);
      toast({
        title: 'Error',
        description: 'Failed to load workspace',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [teamSlug, billId, router, toast]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  const handleStatusChange = async (status: WorkspaceStatus) => {
    if (!teamId) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/teams/${teamId}/workspaces/${billId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update status');
      }

      setWorkspace((prev) => (prev ? { ...prev, status } : null));
      toast({
        title: 'Status updated',
        description: `Status changed to ${status.replace('_', ' ').toLowerCase()}`,
      });
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

  const handlePriorityChange = async (priority: WorkspacePriority) => {
    if (!teamId) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/teams/${teamId}/workspaces/${billId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update priority');
      }

      setWorkspace((prev) => (prev ? { ...prev, priority } : null));
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

  // Handle text selection for annotations (from AnnotatableBillText)
  const handleTextSelect = useCallback((selection: {
    startOffset: number;
    endOffset: number;
    selectedText: string;
  }) => {
    setPendingSelection(selection);
    setShowAnnotationForm(true);
    setSelectedAnnotation(null);
  }, []);

  // Handle clicking on an annotation in the bill text
  const handleAnnotationClick = useCallback((annotationId: string) => {
    const annotation = workspace?.annotations.find((a) => a.id === annotationId);
    if (annotation) {
      setSelectedAnnotation(annotation);
    }
  }, [workspace?.annotations]);

  // Scroll to annotation in bill text
  const scrollToAnnotation = useCallback((annotationId: string) => {
    const element = document.querySelector(`[data-annotation-id="${annotationId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Flash effect
      element.classList.add('ring-2', 'ring-primary');
      setTimeout(() => element.classList.remove('ring-2', 'ring-primary'), 1500);
    }
  }, []);

  // Handle saving workspace summary
  const handleSaveSummary = useCallback(async (summary: string) => {
    if (!teamId) return;

    const response = await fetch(`/api/teams/${teamId}/workspaces/${billId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: summary || null }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update summary');
    }

    setWorkspace((prev) => (prev ? { ...prev, summary: summary || null } : null));
    toast({
      title: 'Summary updated',
      description: 'Workspace summary has been saved.',
    });
  }, [teamId, billId, toast]);

  // Permission helpers
  const canChangeStatus =
    currentUserRole === 'OWNER' ||
    currentUserRole === 'ADMIN' ||
    currentUserRole === 'REVIEWER';
  const canComment =
    currentUserRole === 'OWNER' ||
    currentUserRole === 'ADMIN' ||
    currentUserRole === 'CONTRIBUTOR';
  const canAnnotate = canComment;
  const canChat = canComment;
  const canResolve = canChangeStatus;

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-6 w-96 mb-8" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Skeleton className="h-[600px]" />
          </div>
          <Skeleton className="h-[600px]" />
        </div>
      </div>
    );
  }

  if (!workspace || !teamId) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <p className="text-muted-foreground">Workspace not found</p>
        <Link href={`/teams/${teamSlug}`}>
          <Button className="mt-4">Back to Team</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      {/* Breadcrumb navigation */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/teams" className="hover:text-foreground transition-colors">
          Teams
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/teams/${teamSlug}`} className="hover:text-foreground transition-colors">
          {teamName || teamSlug}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">{workspace.bill.billId}</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{workspace.bill.billId}</h1>
              <Badge variant="secondary">{workspace.bill.billType}</Badge>
            </div>
            <p className="text-muted-foreground mt-1 line-clamp-2">
              {workspace.bill.description}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {canChangeStatus && (
              <>
                <WorkspaceStatusSelect
                  value={workspace.status}
                  onChange={handleStatusChange}
                  disabled={isUpdating}
                />
                <WorkspacePrioritySelect
                  value={workspace.priority}
                  onChange={handlePriorityChange}
                  disabled={isUpdating}
                />
              </>
            )}
            <Link
              href={`/bills/${workspace.bill.billId}`}
              target="_blank"
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <ExternalLink className="h-4 w-4" />
              View Bill
            </Link>
          </div>
        </div>

        {/* Workspace info bar */}
        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
          {workspace.dueDate && (
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Due {new Date(workspace.dueDate).toLocaleDateString()}</span>
            </div>
          )}
          {workspace.assignee && (
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              <span>Assigned to {workspace.assignee.name || workspace.assignee.email}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4" />
            <span>{workspace.commentCount} comments</span>
          </div>
          <div className="flex items-center gap-1">
            <StickyNote className="h-4 w-4" />
            <span>{workspace.annotationCount} annotations</span>
          </div>
        </div>
      </div>

      {/* Summary section */}
      <WorkspaceSummary
        summary={workspace.summary}
        canEdit={canAnnotate}
        onSave={handleSaveSummary}
      />

      {/* Main content */}
      <div className={`grid gap-6 ${showRightPanel ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
        {/* Bill content - Left side */}
        <div className={showRightPanel ? 'lg:col-span-2' : ''}>
          <Card className="h-[700px] flex flex-col">
            <CardHeader className="flex-shrink-0 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Bill Text
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRightPanel(!showRightPanel)}
                  title={showRightPanel ? 'Hide panels' : 'Show panels'}
                >
                  {showRightPanel ? (
                    <PanelRightClose className="h-4 w-4" />
                  ) : (
                    <PanelRightOpen className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {canAnnotate && (
                <p className="text-xs text-muted-foreground">
                  Select text to add an annotation
                </p>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="prose prose-sm dark:prose-invert max-w-none select-text cursor-text pr-4">
                  {workspace.bill.content ? (
                    <AnnotatableBillText
                      content={workspace.bill.content}
                      annotations={workspace.annotations}
                      canAnnotate={canAnnotate}
                      onTextSelect={handleTextSelect}
                      onAnnotationClick={handleAnnotationClick}
                      selectedAnnotationId={selectedAnnotation?.id}
                    />
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Full bill text not available
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar - Tabs for different panels */}
        {showRightPanel && (
          <div className="lg:col-span-1">
            <Card className="h-[700px] flex flex-col">
              <Tabs defaultValue="annotations" className="flex flex-col h-full">
                <CardHeader className="flex-shrink-0 pb-0">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="annotations" className="text-xs">
                      <StickyNote className="h-3 w-3 mr-1" />
                      Annotations
                    </TabsTrigger>
                    <TabsTrigger value="comments" className="text-xs">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Discussion
                    </TabsTrigger>
                    <TabsTrigger value="ai" className="text-xs">
                      <Bot className="h-3 w-3 mr-1" />
                      AI Assistant
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>

                <CardContent className="flex-1 p-0 overflow-hidden">
                  <TabsContent value="annotations" className="h-full m-0">
                    <AnnotationPanel
                      teamId={teamId}
                      billId={billId}
                      annotations={workspace.annotations}
                      currentUserId={session?.user?.id || ''}
                      canAnnotate={canAnnotate}
                      canResolve={canResolve}
                      onAnnotationAdded={fetchWorkspace}
                      onAnnotationClick={setSelectedAnnotation}
                      onScrollToAnnotation={scrollToAnnotation}
                      selectedAnnotation={selectedAnnotation}
                      showCreateForm={showAnnotationForm}
                      pendingSelection={pendingSelection}
                      onCancelCreate={() => {
                        setShowAnnotationForm(false);
                        setPendingSelection(null);
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="comments" className="h-full m-0 p-4 overflow-auto">
                    <CommentThread
                      teamId={teamId}
                      billId={billId}
                      comments={workspace.comments}
                      currentUserId={session?.user?.id || ''}
                      canComment={canComment}
                      onCommentAdded={fetchWorkspace}
                    />
                  </TabsContent>

                  <TabsContent value="ai" className="h-full m-0">
                    <TeamChatPanel
                      teamId={teamId}
                      billId={billId}
                      canChat={canChat}
                    />
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
