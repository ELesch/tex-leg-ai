'use client';

import { useState } from 'react';
import { Bell, BellOff, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useBillNotification, NotificationEventSettings } from '@/hooks/use-bill-notifications';
import { useNotifications } from '@/hooks/use-notifications';
import { useToast } from '@/hooks/use-toast';
import { NotificationSettingsDialog } from './notification-settings-dialog';

interface BillNotificationToggleProps {
  followedBillId: string;
  billId: string;
  compact?: boolean;
}

export function BillNotificationToggle({
  followedBillId,
  billId,
  compact = false,
}: BillNotificationToggleProps) {
  const { preferences, isSupported, isSubscribed } = useNotifications();
  const { notification, isLoading, enable, update, disable } = useBillNotification(followedBillId);
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isNewNotification, setIsNewNotification] = useState(false);

  const globalEnabled = preferences?.enabled && isSubscribed;
  const isEnabled = notification?.enabled ?? false;

  const handleToggle = async () => {
    if (!globalEnabled) {
      toast({
        title: 'Enable notifications first',
        description: 'Turn on global notifications before enabling per-bill alerts.',
        variant: 'destructive',
      });
      return;
    }

    if (isEnabled) {
      // Disable notifications
      const success = await disable();
      if (success) {
        toast({
          title: 'Notifications disabled',
          description: `You will no longer receive notifications for ${billId}.`,
        });
      }
    } else {
      // Show dialog to select events
      setIsNewNotification(true);
      setDialogOpen(true);
    }
  };

  const handleOpenSettings = () => {
    if (!notification) return;
    setIsNewNotification(false);
    setDialogOpen(true);
  };

  const handleSaveSettings = async (settings: NotificationEventSettings): Promise<boolean> => {
    let success: boolean;

    if (isNewNotification) {
      success = await enable(settings);
      if (success) {
        toast({
          title: 'Notifications enabled',
          description: `You will receive notifications for ${billId}.`,
        });
      }
    } else {
      success = await update(settings);
      if (success) {
        toast({
          title: 'Settings updated',
          description: 'Notification preferences have been saved.',
        });
      }
    }

    if (!success) {
      toast({
        title: 'Error',
        description: 'Failed to save notification settings.',
        variant: 'destructive',
      });
    }

    return success;
  };

  if (!isSupported) {
    return null;
  }

  if (isLoading) {
    return (
      <Button variant="ghost" size={compact ? 'icon' : 'sm'} disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={compact ? 'icon' : 'sm'}
              onClick={handleToggle}
              disabled={!globalEnabled && !isEnabled}
              className={isEnabled ? 'text-primary' : 'text-muted-foreground'}
            >
              {isEnabled ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
              {!compact && (
                <span className="ml-1">{isEnabled ? 'On' : 'Off'}</span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {!globalEnabled
              ? 'Enable global notifications first'
              : isEnabled
              ? 'Notifications enabled'
              : 'Enable notifications for this bill'}
          </TooltipContent>
        </Tooltip>

        {isEnabled && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpenSettings}
                className="h-8 w-8"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Configure notification events</TooltipContent>
          </Tooltip>
        )}

        <NotificationSettingsDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          billId={billId}
          initialSettings={
            notification
              ? {
                  statusChange: notification.statusChange,
                  newAction: notification.newAction,
                  newVersion: notification.newVersion,
                  hearingScheduled: notification.hearingScheduled,
                  voteRecorded: notification.voteRecorded,
                }
              : null
          }
          onSave={handleSaveSettings}
          isNew={isNewNotification}
        />
      </div>
    </TooltipProvider>
  );
}
