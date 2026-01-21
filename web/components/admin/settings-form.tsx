'use client';

import { useState } from 'react';
import { SettingType } from '@prisma/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SettingInput } from './setting-input';
import { useToast } from '@/components/ui/use-toast';
import { SETTING_CATEGORIES } from '@/lib/admin/defaults';
import { Loader2 } from 'lucide-react';

interface Setting {
  id: string;
  key: string;
  value: string;
  type: SettingType;
  category: string;
  description: string | null;
  isDefault?: boolean;
}

interface SettingsFormProps {
  initialSettings: Record<string, Setting[]>;
}

const categoryLabels: Record<string, { title: string; description: string }> = {
  session: {
    title: 'Session Settings',
    description: 'Configure the current legislative session',
  },
  sync: {
    title: 'Sync Settings',
    description: 'Configure bill synchronization behavior',
  },
  ai: {
    title: 'AI Settings',
    description: 'Configure AI model and context settings',
  },
  features: {
    title: 'Feature Flags',
    description: 'Enable or disable application features',
  },
};

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  const handleChange = (key: string, value: string) => {
    setPendingChanges((prev) => ({ ...prev, [key]: value }));
  };

  const getCurrentValue = (setting: Setting): string => {
    return pendingChanges[setting.key] ?? setting.value;
  };

  const hasChanges = (key: string): boolean => {
    return key in pendingChanges;
  };

  const saveChanges = async (key: string) => {
    const value = pendingChanges[key];
    if (value === undefined) return;

    setSaving(key);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save setting');
      }

      // Update local state
      setSettings((prev) => {
        const newSettings = { ...prev };
        for (const category of Object.keys(newSettings)) {
          newSettings[category] = newSettings[category].map((s) =>
            s.key === key ? { ...s, value, isDefault: false } : s
          );
        }
        return newSettings;
      });

      // Remove from pending
      setPendingChanges((prev) => {
        const { [key]: _removed, ...rest } = prev;
        void _removed; // Intentionally unused
        return rest;
      });

      toast({
        title: 'Setting saved',
        description: `${key} has been updated.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save setting',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Tabs defaultValue="session" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        {SETTING_CATEGORIES.map((category) => (
          <TabsTrigger key={category} value={category} className="capitalize">
            {category}
          </TabsTrigger>
        ))}
      </TabsList>

      {SETTING_CATEGORIES.map((category) => (
        <TabsContent key={category} value={category}>
          <Card>
            <CardHeader>
              <CardTitle>{categoryLabels[category]?.title || category}</CardTitle>
              <CardDescription>
                {categoryLabels[category]?.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {(settings[category] || []).map((setting) => (
                <div
                  key={setting.key}
                  className="flex items-start justify-between gap-4 rounded-lg border p-4"
                >
                  <div className="flex-1">
                    <SettingInput
                      settingKey={setting.key}
                      value={getCurrentValue(setting)}
                      type={setting.type}
                      description={setting.description}
                      onChange={handleChange}
                      disabled={saving === setting.key}
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => saveChanges(setting.key)}
                    disabled={!hasChanges(setting.key) || saving === setting.key}
                  >
                    {saving === setting.key ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving
                      </>
                    ) : (
                      'Save'
                    )}
                  </Button>
                </div>
              ))}
              {(!settings[category] || settings[category].length === 0) && (
                <p className="text-sm text-muted-foreground">
                  No settings in this category.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}
