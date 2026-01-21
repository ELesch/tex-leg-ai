'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Lock, Bookmark, Trash2, Bot, CheckCircle2 } from 'lucide-react';

type AIProvider = 'openai' | 'anthropic' | 'google';

interface ModelOption {
  id: string;
  label: string;
}

const MODELS_BY_PROVIDER: Record<AIProvider, ModelOption[]> = {
  openai: [
    { id: 'gpt-5-2', label: 'GPT-5.2' },
    { id: 'gpt-4.1', label: 'GPT-4.1' },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { id: 'gpt-5', label: 'GPT-5' },
    { id: 'gpt-5-mini', label: 'GPT-5 Mini' },
  ],
  anthropic: [
    { id: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5' },
    { id: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ],
  google: [
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro' },
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
  ],
};

export default function SettingsPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [savedBills, setSavedBills] = useState<any[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(true);

  const [aiProvider, setAiProvider] = useState<AIProvider>('openai');
  const [aiModel, setAiModel] = useState('');
  const [aiApiKey, setAiApiKey] = useState('');
  const [hasExistingApiKey, setHasExistingApiKey] = useState(false);
  const [isLoadingAiSettings, setIsLoadingAiSettings] = useState(true);
  const [isSavingAiSettings, setIsSavingAiSettings] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
    if (session?.user?.name) {
      setName(session.user.name);
    }
  }, [session, status, router]);

  useEffect(() => {
    async function fetchSavedBills() {
      try {
        const res = await fetch('/api/saved');
        if (res.ok) {
          const data = await res.json();
          setSavedBills(data.savedBills || []);
        }
      } catch (error) {
        console.error('Failed to fetch saved bills:', error);
      } finally {
        setIsLoadingSaved(false);
      }
    }
    if (status === 'authenticated') {
      fetchSavedBills();
    }
  }, [status]);

  useEffect(() => {
    async function fetchAiSettings() {
      try {
        const res = await fetch('/api/user/ai-settings');
        if (res.ok) {
          const data = await res.json();
          if (data.provider) {
            setAiProvider(data.provider as AIProvider);
          }
          if (data.model) {
            setAiModel(data.model);
          }
          setHasExistingApiKey(!!data.hasApiKey);
        }
      } catch (error) {
        console.error('Failed to fetch AI settings:', error);
      } finally {
        setIsLoadingAiSettings(false);
      }
    }
    if (status === 'authenticated') {
      fetchAiSettings();
    }
  }, [status]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);

    try {
      const res = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (res.ok) {
        await update({ name });
        toast({
          title: 'Profile updated',
          description: 'Your profile has been updated successfully.',
        });
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to update profile',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'New passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: 'Error',
        description: 'Password must be at least 8 characters',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (res.ok) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        toast({
          title: 'Password updated',
          description: 'Your password has been changed successfully.',
        });
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to update password',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleRemoveSavedBill = async (billId: string) => {
    try {
      const res = await fetch('/api/saved', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId }),
      });

      if (res.ok) {
        setSavedBills(savedBills.filter(sb => sb.bill.billId !== billId));
        toast({
          title: 'Bill removed',
          description: 'The bill has been removed from your saved list.',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to remove bill',
        variant: 'destructive',
      });
    }
  };

  const handleProviderChange = (value: string) => {
    const newProvider = value as AIProvider;
    setAiProvider(newProvider);
    // Reset model when provider changes
    setAiModel(MODELS_BY_PROVIDER[newProvider][0].id);
  };

  const handleSaveAiSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAiSettings(true);

    try {
      const res = await fetch('/api/user/ai-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: aiProvider,
          model: aiModel,
          apiKey: aiApiKey || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setHasExistingApiKey(!!data.hasApiKey);
        if (aiApiKey) {
          setAiApiKey(''); // Clear the input after saving
        }
        toast({
          title: 'AI settings saved',
          description: 'Your AI settings have been updated successfully.',
        });
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to save AI settings',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingAiSettings(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <CardTitle>Profile</CardTitle>
          </div>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={session?.user?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <Button type="submit" disabled={isUpdatingProfile}>
              {isUpdatingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* AI Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <CardTitle>AI Settings</CardTitle>
          </div>
          <CardDescription>Configure your AI provider and model preferences</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAiSettings ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSaveAiSettings} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="ai-provider" className="text-sm font-medium">
                  Provider
                </label>
                <Select value={aiProvider} onValueChange={handleProviderChange}>
                  <SelectTrigger id="ai-provider">
                    <SelectValue placeholder="Select a provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label htmlFor="ai-model" className="text-sm font-medium">
                  Model
                </label>
                <Select value={aiModel} onValueChange={setAiModel}>
                  <SelectTrigger id="ai-model">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS_BY_PROVIDER[aiProvider].map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label htmlFor="ai-api-key" className="text-sm font-medium">
                  API Key
                </label>
                <Input
                  id="ai-api-key"
                  type="password"
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  placeholder={hasExistingApiKey ? "Enter new key to replace existing" : "Enter your API key"}
                />
                {hasExistingApiKey ? (
                  <p className="flex items-center gap-1 text-xs text-green-600 dark:text-green-500">
                    <CheckCircle2 className="h-3 w-3" />
                    API key saved. Leave blank to keep current key.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Your API key is encrypted and stored securely
                  </p>
                )}
              </div>
              <Button type="submit" disabled={isSavingAiSettings}>
                {isSavingAiSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save AI Settings
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Password Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            <CardTitle>Password</CardTitle>
          </div>
          <CardDescription>Change your password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="currentPassword" className="text-sm font-medium">
                Current Password
              </label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="newPassword" className="text-sm font-medium">
                New Password
              </label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm New Password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button type="submit" disabled={isUpdatingPassword}>
              {isUpdatingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Saved Bills */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bookmark className="h-5 w-5" />
            <CardTitle>Saved Bills</CardTitle>
          </div>
          <CardDescription>Bills you&apos;ve saved for later</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingSaved ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : savedBills.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              You haven&apos;t saved any bills yet. Browse bills and click the save button to add them here.
            </p>
          ) : (
            <div className="space-y-3">
              {savedBills.map((saved) => (
                <div
                  key={saved.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{saved.bill.billId}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {saved.bill.description}
                    </p>
                    {saved.notes && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Note: {saved.notes}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveSavedBill(saved.bill.billId)}
                    className="ml-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <Button variant="destructive" disabled>
            Delete Account (Coming Soon)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
