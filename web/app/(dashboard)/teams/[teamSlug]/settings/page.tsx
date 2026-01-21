'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { TeamDetails } from '@/hooks/use-teams';

export default function TeamSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const teamSlug = params.teamSlug as string;

  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [aiProvider, setAiProvider] = useState<string>('');
  const [aiModel, setAiModel] = useState('');
  const [aiApiKey, setAiApiKey] = useState('');

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        // Get team ID from slug
        const teamsResponse = await fetch('/api/teams');
        if (!teamsResponse.ok) throw new Error('Failed to fetch teams');
        const { teams } = await teamsResponse.json();
        const teamSummary = teams.find((t: { slug: string }) => t.slug === teamSlug);

        if (!teamSummary) {
          router.push('/teams');
          return;
        }

        setTeamId(teamSummary.id);

        const response = await fetch(`/api/teams/${teamSummary.id}`);
        if (!response.ok) {
          if (response.status === 404 || response.status === 403) {
            router.push('/teams');
            return;
          }
          throw new Error('Failed to fetch team');
        }

        const data = await response.json();
        setTeam(data.team);
        setName(data.team.name);
        setDescription(data.team.description || '');
        setAiProvider(data.team.aiProvider || '');
        setAiModel(data.team.aiModel || '');
      } catch (error) {
        console.error('Error fetching team:', error);
        toast({
          title: 'Error',
          description: 'Failed to load team settings',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeam();
  }, [teamSlug, router, toast]);

  const handleSave = async () => {
    if (!teamId) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          aiProvider: aiProvider || null,
          aiModel: aiModel.trim() || null,
          aiApiKey: aiApiKey.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update team');
      }

      const { team: updatedTeam } = await response.json();

      toast({
        title: 'Settings saved',
        description: 'Team settings have been updated.',
      });

      // If slug changed, redirect to new URL
      if (updatedTeam.slug !== teamSlug) {
        router.push(`/teams/${updatedTeam.slug}/settings`);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!teamId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete team');
      }

      toast({
        title: 'Team deleted',
        description: 'The team has been permanently deleted.',
      });

      router.push('/teams');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete team',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <p className="text-muted-foreground">Team not found</p>
        <Link href="/teams">
          <Button className="mt-4">Back to Teams</Button>
        </Link>
      </div>
    );
  }

  const isOwner = team.currentUserRole === 'OWNER';
  const isAdmin = team.currentUserRole === 'ADMIN' || isOwner;

  if (!isAdmin) {
    router.push(`/teams/${teamSlug}`);
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <Link
        href={`/teams/${teamSlug}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Team
      </Link>

      <h1 className="text-3xl font-bold mb-8">Team Settings</h1>

      {/* General Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Basic team information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Team Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* AI Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>AI Settings</CardTitle>
          <CardDescription>
            Configure the AI provider for team chat. If not set, individual
            member settings will be used.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="aiProvider">AI Provider</Label>
            <Select value={aiProvider} onValueChange={setAiProvider}>
              <SelectTrigger>
                <SelectValue placeholder="Use member's provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Use member&apos;s provider</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="google">Google AI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {aiProvider && (
            <>
              <div className="space-y-2">
                <Label htmlFor="aiModel">Model ID</Label>
                <Input
                  id="aiModel"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  placeholder="e.g., gpt-4.1, claude-sonnet-4-5-20250929"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="aiApiKey">API Key</Label>
                <Input
                  id="aiApiKey"
                  type="password"
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  placeholder={team.hasApiKey ? '••••••••••••' : 'Enter API key'}
                />
                <p className="text-xs text-muted-foreground">
                  {team.hasApiKey
                    ? 'A team API key is already set. Enter a new value to replace it.'
                    : 'Leave empty to use team owner\'s API key.'}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end mb-8">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>

      {/* Danger Zone */}
      {isOwner && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions that affect the entire team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Separator className="mb-4" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Delete Team</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete this team and all its workspaces, comments,
                  and annotations.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isDeleting}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Team
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Team</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete &quot;{team.name}&quot;? This action
                      cannot be undone. All workspaces, comments, annotations, and
                      chat history will be permanently deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Delete Team
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
