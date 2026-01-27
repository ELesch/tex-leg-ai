'use client';

import { useCallback } from 'react';
import useSWR from 'swr';

export interface BillNotificationSettings {
  id: string;
  userId: string;
  followedBillId: string;
  enabled: boolean;
  statusChange: boolean;
  newAction: boolean;
  newVersion: boolean;
  hearingScheduled: boolean;
  voteRecorded: boolean;
}

export interface NotificationEventSettings {
  statusChange: boolean;
  newAction: boolean;
  newVersion: boolean;
  hearingScheduled: boolean;
  voteRecorded: boolean;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) {
      return { notification: null };
    }
    throw new Error('Failed to fetch');
  }
  return res.json();
};

export function useBillNotification(followedBillId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ notification: BillNotificationSettings | null }>(
    followedBillId ? `/api/notifications/bills/${followedBillId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const enable = useCallback(async (settings: NotificationEventSettings) => {
    if (!followedBillId) return false;

    try {
      const res = await fetch(`/api/notifications/bills/${followedBillId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        mutate();
        return true;
      }
    } catch {
      // Error handled below
    }

    return false;
  }, [followedBillId, mutate]);

  const update = useCallback(async (settings: Partial<NotificationEventSettings & { enabled: boolean }>) => {
    if (!followedBillId) return false;

    try {
      const res = await fetch(`/api/notifications/bills/${followedBillId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        mutate();
        return true;
      }
    } catch {
      // Error handled below
    }

    return false;
  }, [followedBillId, mutate]);

  const disable = useCallback(async () => {
    if (!followedBillId) return false;

    try {
      const res = await fetch(`/api/notifications/bills/${followedBillId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        mutate();
        return true;
      }
    } catch {
      // Error handled below
    }

    return false;
  }, [followedBillId, mutate]);

  return {
    notification: data?.notification ?? null,
    isLoading,
    isError: !!error,
    isEnabled: !!data?.notification?.enabled,
    enable,
    update,
    disable,
    mutate,
  };
}

/**
 * Hook to get notification settings for multiple followed bills
 */
export function useBillNotificationsMap(followedBillIds: string[]) {
  // Use SWR to fetch all at once via the preferences endpoint
  const { data, error, isLoading, mutate } = useSWR<{ notification: BillNotificationSettings | null }[]>(
    followedBillIds.length > 0
      ? followedBillIds.map(id => `/api/notifications/bills/${id}`)
      : null,
    async (urls: string[]) => {
      const results = await Promise.all(
        urls.map(url =>
          fetch(url)
            .then(res => res.ok ? res.json() : { notification: null })
            .catch(() => ({ notification: null }))
        )
      );
      return results;
    },
    { revalidateOnFocus: false }
  );

  // Create a map of followedBillId -> notification settings
  const notificationsMap = new Map<string, BillNotificationSettings | null>();
  if (data) {
    followedBillIds.forEach((id, index) => {
      notificationsMap.set(id, data[index]?.notification ?? null);
    });
  }

  return {
    notificationsMap,
    isLoading,
    isError: !!error,
    mutate,
  };
}
