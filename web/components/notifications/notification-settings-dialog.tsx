'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { NotificationEventSettings } from '@/hooks/use-bill-notifications';

interface NotificationSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billId: string;
  initialSettings?: NotificationEventSettings | null;
  onSave: (settings: NotificationEventSettings) => Promise<boolean>;
  isNew?: boolean;
}

const EVENT_OPTIONS = [
  {
    key: 'statusChange' as const,
    label: 'Status changed',
    description: 'e.g., "Passed House", "Signed by Governor"',
  },
  {
    key: 'newAction' as const,
    label: 'New action recorded',
    description: 'Any new legislative action on the bill',
  },
  {
    key: 'newVersion' as const,
    label: 'New amendment/version',
    description: 'New version or amendment is available',
  },
  {
    key: 'hearingScheduled' as const,
    label: 'Committee hearing scheduled',
    description: 'A hearing has been scheduled for this bill',
  },
  {
    key: 'voteRecorded' as const,
    label: 'Vote recorded',
    description: 'A vote has been taken on this bill',
  },
];

export function NotificationSettingsDialog({
  open,
  onOpenChange,
  billId,
  initialSettings,
  onSave,
  isNew = false,
}: NotificationSettingsDialogProps) {
  const [settings, setSettings] = useState<NotificationEventSettings>({
    statusChange: true,
    newAction: true,
    newVersion: true,
    hearingScheduled: true,
    voteRecorded: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Initialize with provided settings or defaults
  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings);
    } else {
      setSettings({
        statusChange: true,
        newAction: true,
        newVersion: true,
        hearingScheduled: true,
        voteRecorded: true,
      });
    }
  }, [initialSettings, open]);

  const handleToggle = (key: keyof NotificationEventSettings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const success = await onSave(settings);
    setIsSaving(false);

    if (success) {
      onOpenChange(false);
    }
  };

  const anySelected = Object.values(settings).some(v => v);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isNew ? 'Enable Notifications' : 'Notification Settings'}
          </DialogTitle>
          <DialogDescription>
            Select which events you want to be notified about for {billId}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {EVENT_OPTIONS.map(option => (
            <div key={option.key} className="flex items-start space-x-3">
              <Checkbox
                id={option.key}
                checked={settings[option.key]}
                onCheckedChange={() => handleToggle(option.key)}
              />
              <div className="space-y-1 leading-none">
                <Label
                  htmlFor={option.key}
                  className="text-sm font-medium cursor-pointer"
                >
                  {option.label}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {option.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !anySelected}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
