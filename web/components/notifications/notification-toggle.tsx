'use client';

import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useNotifications } from '@/hooks/use-notifications';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NotificationToggleProps {
  className?: string;
}

export function NotificationToggle({ className }: NotificationToggleProps) {
  const {
    preferences,
    isLoading,
    isSupported,
    permission,
    isSubscribed,
    isRegistering,
    toggleEnabled,
  } = useNotifications();
  const { toast } = useToast();

  const handleToggle = async (checked: boolean) => {
    const success = await toggleEnabled(checked);

    if (!success) {
      if (permission === 'denied') {
        toast({
          title: 'Notifications blocked',
          description: 'Please enable notifications in your browser settings.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to update notification settings.',
          variant: 'destructive',
        });
      }
      return;
    }

    toast({
      title: checked ? 'Notifications enabled' : 'Notifications disabled',
      description: checked
        ? 'You will receive notifications for followed bills.'
        : 'You will no longer receive notifications.',
    });
  };

  if (!isSupported) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
              <BellOff className="h-4 w-4" />
              <span className="text-sm">Notifications not supported</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Push notifications are not supported in your browser.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const isEnabled = preferences?.enabled && isSubscribed;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Label htmlFor="notifications" className="flex items-center gap-2 text-sm cursor-pointer">
        {isEnabled ? (
          <Bell className="h-4 w-4 text-primary" />
        ) : (
          <BellOff className="h-4 w-4 text-muted-foreground" />
        )}
        <span>Notifications</span>
      </Label>
      {isLoading || isRegistering ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Switch
          id="notifications"
          checked={isEnabled}
          onCheckedChange={handleToggle}
          disabled={permission === 'denied'}
        />
      )}
    </div>
  );
}
