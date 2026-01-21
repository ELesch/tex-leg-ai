'use client';

import useSWR from 'swr';
import { WorkspaceStatus, WorkspacePriority } from '@prisma/client';

export interface WorkspaceSummary {
  id: string;
  billId: string;
  billDbId: string;
  billType: string;
  billNumber: number;
  billDescription: string;
  billStatus: string | null;
  status: WorkspaceStatus;
  priority: WorkspacePriority;
  dueDate: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  summary: string | null;
  annotationCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('Failed to fetch workspaces');
    throw error;
  }
  return res.json();
};

export function useTeamWorkspaces(teamId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ workspaces: WorkspaceSummary[] }>(
    teamId ? `/api/teams/${teamId}/workspaces` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    workspaces: data?.workspaces ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

export async function addBillToWorkspace(
  teamId: string,
  billId: string,
  options?: {
    priority?: WorkspacePriority;
    dueDate?: string;
    summary?: string;
  }
): Promise<{ workspace: WorkspaceSummary }> {
  const response = await fetch(`/api/teams/${teamId}/workspaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      billId,
      ...options,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to add bill to workspace');
  }

  return response.json();
}
