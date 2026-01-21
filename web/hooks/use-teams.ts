'use client';

import useSWR from 'swr';
import { TeamRole, WorkspaceStatus, WorkspacePriority } from '@prisma/client';

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

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('Failed to fetch teams');
    throw error;
  }
  return res.json();
};

export function useTeams() {
  const { data, error, isLoading, mutate } = useSWR<{ teams: TeamSummary[] }>(
    '/api/teams',
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    teams: data?.teams ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
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

export function useTeam(teamId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ team: TeamDetails }>(
    teamId ? `/api/teams/${teamId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    team: data?.team ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
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

export function useTeamInvitations(teamId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ invitations: TeamInvitation[] }>(
    teamId ? `/api/teams/${teamId}/invitations` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    invitations: data?.invitations ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
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

export function useInvitation(token: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ invitation: InvitationDetails }>(
    token ? `/api/invitations/${token}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    invitation: data?.invitation ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
