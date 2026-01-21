'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkspaceCard } from '@/components/teams/workspace-card';
import { TeamMembers } from '@/components/teams/team-members';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  Settings,
  Users,
  FileText,
  Plus,
  Link2,
  Copy,
  ArrowLeft,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TeamDetails, TeamMember, WorkspaceSummary } from '@/hooks/use-teams';
import { TeamRole } from '@prisma/client';

interface TeamData extends TeamDetails {
  members: TeamMember[];
  recentWorkspaces: WorkspaceSummary[];
}

export default function TeamDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();
  const teamSlug = params.teamSlug as string;

  const [team, setTeam] = useState<TeamData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<TeamRole>('CONTRIBUTOR');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);

  const fetchTeam = async () => {
    try {
      // First, we need to get the team ID from the slug
      const teamsResponse = await fetch('/api/teams');
      if (!teamsResponse.ok) throw new Error('Failed to fetch teams');
      const { teams } = await teamsResponse.json();
      const teamSummary = teams.find((t: { slug: string }) => t.slug === teamSlug);

      if (!teamSummary) {
        router.push('/teams');
        return;
      }

      const response = await fetch(`/api/teams/${teamSummary.id}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push('/teams');
          return;
        }
        throw new Error('Failed to fetch team');
      }

      const data = await response.json();
      setTeam(data.team);
    } catch (error) {
      console.error('Error fetching team:', error);
      toast({
        title: 'Error',
        description: 'Failed to load team',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [teamSlug]);

  const handleCreateInvite = async () => {
    if (!team) return;

    setIsCreatingInvite(true);
    try {
      const response = await fetch(`/api/teams/${team.id}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: inviteRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create invite');
      }

      const { invitation } = await response.json();
      setInviteLink(invitation.inviteUrl);

      toast({
        title: 'Invite link created',
        description: 'Share this link with people you want to invite.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create invite',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const copyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      toast({
        title: 'Copied',
        description: 'Invite link copied to clipboard',
      });
    }
  };

  const canManageMembers =
    team?.currentUserRole === 'OWNER' || team?.currentUserRole === 'ADMIN';

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-8" />
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
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

  return (
    <div className="container mx-auto py-8 px-4">
      <Link
        href="/teams"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        All Teams
      </Link>

      {/* Team Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{team.name}</h1>
            <Badge variant="secondary">{team.currentUserRole.toLowerCase()}</Badge>
          </div>
          {team.description && (
            <p className="text-muted-foreground mt-1">{team.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          {canManageMembers && (
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Link2 className="mr-2 h-4 w-4" />
                  Invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite to Team</DialogTitle>
                  <DialogDescription>
                    Create an invite link to share with people you want to add to
                    the team.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={inviteRole}
                      onValueChange={(v) => setInviteRole(v as TeamRole)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {team.currentUserRole === 'OWNER' && (
                          <SelectItem value="ADMIN">Admin</SelectItem>
                        )}
                        <SelectItem value="CONTRIBUTOR">Contributor</SelectItem>
                        <SelectItem value="REVIEWER">Reviewer</SelectItem>
                        <SelectItem value="VIEWER">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {inviteLink ? (
                    <div className="space-y-2">
                      <Label>Invite Link</Label>
                      <div className="flex gap-2">
                        <Input value={inviteLink} readOnly />
                        <Button variant="outline" onClick={copyInviteLink}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        This link expires in 7 days
                      </p>
                    </div>
                  ) : (
                    <Button
                      onClick={handleCreateInvite}
                      disabled={isCreatingInvite}
                      className="w-full"
                    >
                      Generate Invite Link
                    </Button>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
          {canManageMembers && (
            <Link href={`/teams/${teamSlug}/settings`}>
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{team.memberCount}</span>
              <div className="flex -space-x-2">
                {team.members.slice(0, 4).map((member) => (
                  <Avatar key={member.userId} className="h-8 w-8 border-2 border-background">
                    <AvatarImage src={member.image || undefined} />
                    <AvatarFallback className="text-xs">
                      {(member.name || member.email)[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {team.memberCount > 4 && (
                  <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
                    +{team.memberCount - 4}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bills in Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{team.workspaceCount}</span>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              AI Chat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {team.hasApiKey ? 'Team API key configured' : 'Using member keys'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="workspaces">
        <TabsList>
          <TabsTrigger value="workspaces">
            <FileText className="mr-2 h-4 w-4" />
            Workspaces
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users className="mr-2 h-4 w-4" />
            Members
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workspaces" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Team Workspaces</h2>
            <Link href={`/bills`}>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Bill
              </Button>
            </Link>
          </div>

          {team.recentWorkspaces.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No workspaces yet</h3>
                <p className="mt-2 text-muted-foreground">
                  Add bills to this team to start collaborating.
                </p>
                <Link href="/bills">
                  <Button className="mt-4">Browse Bills</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {team.recentWorkspaces.map((workspace) => (
                <WorkspaceCard
                  key={workspace.id}
                  workspace={workspace}
                  teamSlug={teamSlug}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Team Members</h2>
          </div>
          <Card>
            <CardContent className="pt-6">
              <TeamMembers
                teamId={team.id}
                members={team.members}
                currentUserRole={team.currentUserRole}
                currentUserId={session?.user?.id || ''}
                onMemberUpdated={fetchTeam}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
