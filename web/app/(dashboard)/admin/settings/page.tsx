import { getSettingsByCategory } from '@/lib/admin/settings';
import { SettingsForm } from '@/components/admin/settings-form';

export default async function AdminSettingsPage() {
  const settings = await getSettingsByCategory();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">System Settings</h2>
        <p className="text-muted-foreground">
          Configure application settings and feature flags
        </p>
      </div>

      <SettingsForm initialSettings={settings} />
    </div>
  );
}
