'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Eye, EyeOff } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ViewPreferencesToggleProps {
  hideRevisionHistory: boolean;
  onHideRevisionHistoryChange: (hide: boolean) => void;
  className?: string;
}

export function ViewPreferencesToggle({
  hideRevisionHistory,
  onHideRevisionHistoryChange,
  className,
}: ViewPreferencesToggleProps) {
  const { data: session } = useSession();
  const [isSaving, setIsSaving] = useState(false);

  // Fetch user's saved preferences on mount
  useEffect(() => {
    if (!session?.user) return;

    async function fetchPreferences() {
      try {
        const response = await fetch('/api/statutes/preferences');
        if (response.ok) {
          const data = await response.json();
          if (data.preferences.hideRevisionHistory !== hideRevisionHistory) {
            onHideRevisionHistoryChange(data.preferences.hideRevisionHistory);
          }
        }
      } catch (error) {
        console.error('Error fetching preferences:', error);
      }
    }
    fetchPreferences();
  }, [session?.user]); // Only on mount when session is available

  // Save preference to server
  const savePreference = useCallback(async (hide: boolean) => {
    if (!session?.user) return;

    setIsSaving(true);
    try {
      await fetch('/api/statutes/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hideRevisionHistory: hide }),
      });
    } catch (error) {
      console.error('Error saving preference:', error);
    } finally {
      setIsSaving(false);
    }
  }, [session?.user]);

  const handleChange = useCallback((checked: boolean) => {
    onHideRevisionHistoryChange(checked);
    savePreference(checked);
  }, [onHideRevisionHistoryChange, savePreference]);

  return (
    <div className={className}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center space-x-2">
            <Switch
              id="hide-revision"
              checked={hideRevisionHistory}
              onCheckedChange={handleChange}
              disabled={isSaving}
            />
            <Label
              htmlFor="hide-revision"
              className="text-sm cursor-pointer flex items-center gap-1.5"
            >
              {hideRevisionHistory ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
              Hide metadata
            </Label>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Hide revision history and source citations</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
