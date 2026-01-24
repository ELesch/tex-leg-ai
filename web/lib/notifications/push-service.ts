import webpush from 'web-push';
import { prisma } from '@/lib/db/prisma';

// Configure VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@texlegai.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export type NotificationEventType =
  | 'statusChange'
  | 'newAction'
  | 'newVersion'
  | 'hearingScheduled'
  | 'voteRecorded';

export interface BillNotificationPayload {
  title: string;
  body: string;
  billId: string;
  eventType: NotificationEventType;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
}

/**
 * Send push notification to a specific user
 */
export async function sendPushNotification(
  userId: string,
  payload: BillNotificationPayload
): Promise<{ success: number; failed: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('VAPID keys not configured, skipping push notification');
    return { success: 0, failed: 0 };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) {
    return { success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;

  const jsonPayload = JSON.stringify(payload);

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        jsonPayload
      );
      success++;
    } catch (error: unknown) {
      console.error('Failed to send push notification:', error);
      failed++;

      // Remove invalid subscriptions (410 Gone or 404 Not Found)
      if (
        error instanceof webpush.WebPushError &&
        (error.statusCode === 410 || error.statusCode === 404)
      ) {
        await prisma.pushSubscription.delete({
          where: { id: subscription.id },
        });
      }
    }
  }

  return { success, failed };
}

/**
 * Send notification for a bill change to all users who have notifications enabled for it
 */
export async function notifyBillChange(
  billId: string,
  eventType: NotificationEventType,
  title: string,
  body: string
): Promise<{ total: number; success: number; failed: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('VAPID keys not configured, skipping push notifications');
    return { total: 0, success: 0, failed: 0 };
  }

  // Find all bill notifications for this bill where the event type is enabled
  const notifications = await prisma.billNotification.findMany({
    where: {
      followedBill: {
        bill: { billId },
      },
      enabled: true,
      // Filter by event type
      ...(eventType === 'statusChange' && { statusChange: true }),
      ...(eventType === 'newAction' && { newAction: true }),
      ...(eventType === 'newVersion' && { newVersion: true }),
      ...(eventType === 'hearingScheduled' && { hearingScheduled: true }),
      ...(eventType === 'voteRecorded' && { voteRecorded: true }),
    },
    include: {
      user: {
        include: {
          pushSubscriptions: true,
          notificationPreference: true,
        },
      },
    },
  });

  let totalSuccess = 0;
  let totalFailed = 0;

  const payload: BillNotificationPayload = {
    title,
    body,
    billId,
    eventType,
    url: `/bills/${billId}`,
    tag: `bill-${billId}-${eventType}`,
    requireInteraction: eventType === 'hearingScheduled',
  };

  const jsonPayload = JSON.stringify(payload);

  for (const notification of notifications) {
    // Skip if user has global notifications disabled
    if (!notification.user.notificationPreference?.enabled) {
      continue;
    }

    for (const subscription of notification.user.pushSubscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          jsonPayload
        );
        totalSuccess++;
      } catch (error: unknown) {
        console.error('Failed to send push notification:', error);
        totalFailed++;

        // Remove invalid subscriptions
        if (
          error instanceof webpush.WebPushError &&
          (error.statusCode === 410 || error.statusCode === 404)
        ) {
          await prisma.pushSubscription.delete({
            where: { id: subscription.id },
          });
        }
      }
    }
  }

  return { total: notifications.length, success: totalSuccess, failed: totalFailed };
}

/**
 * Get the VAPID public key for client-side subscription
 */
export function getVapidPublicKey(): string | undefined {
  return vapidPublicKey;
}
