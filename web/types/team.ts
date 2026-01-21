import {
  TeamRole,
  WorkspaceStatus,
  WorkspacePriority,
  AnnotationType,
  ActivityType,
} from '@prisma/client';

export type { TeamRole, WorkspaceStatus, WorkspacePriority, AnnotationType, ActivityType };

export interface TeamSummary {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  role: TeamRole;
  joinedAt: string;
  memberCount: number;
  workspaceCount: number;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  role: TeamRole;
  joinedAt: string;
}

export interface WorkspaceSummary {
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
}

export interface TeamDetails {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: string;
  updatedAt: string;
  aiProvider?: string;
  aiModel?: string;
  hasApiKey: boolean;
  memberCount: number;
  workspaceCount: number;
  activityCount: number;
  currentUserRole: TeamRole;
  members: TeamMember[];
  recentWorkspaces: WorkspaceSummary[];
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: TeamRole;
  token: string;
  expiresAt: string;
  createdAt: string;
  inviteUrl?: string;
  teamName?: string;
}

export interface InvitationDetails {
  id: string;
  role: TeamRole;
  expiresAt: string;
  team: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    memberCount: number;
  };
}

export interface Annotation {
  id: string;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  content: string;
  type: AnnotationType;
  resolved: boolean;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  content: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  createdAt: string;
  updatedAt: string;
  replies?: Comment[];
}

export interface Activity {
  id: string;
  type: ActivityType;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
}
