'use client';

import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';

export interface NotificationPreferences {
  id: string;
  userId: string;
  enabled: boolean;
  defaultStatusChange: boolean;
  defaultNewAction: boolean;
  defaultNewVersion: boolean;
  defaultHearingScheduled: boolean;
  defaultVoteRecorded: boolean;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch');
  }
  return res.json();
};

export function useNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<{ preferences: NotificationPreferences }>(
    '/api/notifications/preferences',
    fetcher,
    { revalidateOnFocus: false }
  );

  // Check if push notifications are supported
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if (supported && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Fetch VAPID key
  useEffect(() => {
    if (isSupported) {
      fetch('/api/notifications/vapid-key')
        .then((res) => res.json())
        .then((data) => {
          if (data.publicKey) {
            setVapidKey(data.publicKey);
          }
        })
        .catch(() => {
          // VAPID key not configured
        });
    }
  }, [isSupported]);

  // Check if already subscribed
  useEffect(() => {
    if (isSupported) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((subscription) => {
          setIsSubscribed(!!subscription);
        });
      });
    }
  }, [isSupported]);

  // Register service worker and subscribe to push
  const subscribe = useCallback(async () => {
    if (!isSupported || !vapidKey) {
      return false;
    }

    setIsRegistering(true);

    try {
      // Request notification permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        setIsRegistering(false);
        return false;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Send subscription to server
      const response = await fetch('/api/notifications/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
            auth: arrayBufferToBase64(subscription.getKey('auth')),
          },
        }),
      });

      if (response.ok) {
        setIsSubscribed(true);
        mutate();
        setIsRegistering(false);
        return true;
      }
    } catch (err) {
      console.error('Error subscribing to push:', err);
    }

    setIsRegistering(false);
    return false;
  }, [isSupported, vapidKey, mutate]);

  // Unsubscribe from push
  const unsubscribe = useCallback(async () => {
    if (!isSupported) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Notify server
        await fetch('/api/notifications/subscription', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        // Unsubscribe locally
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      mutate();
      return true;
    } catch (err) {
      console.error('Error unsubscribing from push:', err);
    }

    return false;
  }, [isSupported, mutate]);

  // Toggle global notifications
  const toggleEnabled = useCallback(async (enabled: boolean) => {
    if (enabled) {
      const success = await subscribe();
      if (!success) {
        return false;
      }
    } else {
      await unsubscribe();
    }

    try {
      await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      mutate();
      return true;
    } catch {
      return false;
    }
  }, [subscribe, unsubscribe, mutate]);

  // Update default preferences
  const updateDefaults = useCallback(async (defaults: Partial<NotificationPreferences>) => {
    try {
      await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaults),
      });
      mutate();
      return true;
    } catch {
      return false;
    }
  }, [mutate]);

  return {
    preferences: data?.preferences ?? null,
    isLoading,
    isError: !!error,
    isSupported,
    permission,
    isSubscribed,
    isRegistering,
    subscribe,
    unsubscribe,
    toggleEnabled,
    updateDefaults,
    mutate,
  };
}

// Helper functions
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray.buffer as ArrayBuffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
