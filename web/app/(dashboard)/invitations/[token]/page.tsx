'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useInvitation } from '@/hooks/use-teams';
import { Users, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { TeamRole } from '@prisma/client';

const roleDescriptions: Record<TeamRole, string> = {
  OWNER: 'Full control over the team',
  ADMIN: 'Manage members and settings',
  CONTRIBUTOR: 'Add comments, annotations, and chat with AI',
  REVIEWER: 'Review bills and change status',
  VIEWER: 'View-only access',
};

export default function InvitationPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { toast } = useToast();
  const token = params.token as string;

  const { invitation, isLoading, isError, error } = useInvitation(token);
  const [isAccepting, setIsAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      const response = await fetch(`/api/invitations/${token}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to accept invitation');
      }

      if (data.alreadyMember) {
        toast({
          title: 'Already a member',
          description: 'You are already a member of this team.',
        });
      } else {
        toast({
          title: 'Welcome to the team!',
          description: `You have joined ${data.team.name}.`,
        });
      }

      setAccepted(true);

      // Redirect to team after a short delay
      setTimeout(() => {
        router.push(`/teams/${data.team.slug}`);
      }, 1500);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to accept invitation',
        variant: 'destructive',
      });
    } finally {
      setIsAccepting(false);
    }
  };

  // Handle unauthenticated users
  if (sessionStatus === 'loading' || isLoading) {
    return (
      <div className="container mx-auto py-16 px-4 max-w-md">
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sessionStatus === 'unauthenticated') {
    return (
      <div className="container mx-auto py-16 px-4 max-w-md">
        <Card>
          <CardHeader className="text-center">
            <Users className="mx-auto h-12 w-12 text-primary" />
            <CardTitle className="mt-4">Team Invitation</CardTitle>
            <CardDescription>
              You need to sign in to accept this invitation
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href={`/login?callbackUrl=/invitations/${token}`}>
              <Button className="w-full">Sign In to Continue</Button>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href={`/register?callbackUrl=/invitations/${token}`} className="text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !invitation) {
    return (
      <div className="container mx-auto py-16 px-4 max-w-md">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="mt-4 text-lg font-semibold">Invalid Invitation</h2>
            <p className="mt-2 text-muted-foreground">
              This invitation link is invalid or has expired.
            </p>
            <Link href="/teams">
              <Button className="mt-6">Go to Teams</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="container mx-auto py-16 px-4 max-w-md">
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <h2 className="mt-4 text-lg font-semibold">Welcome!</h2>
            <p className="mt-2 text-muted-foreground">
              You have joined {invitation.team.name}. Redirecting...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-16 px-4 max-w-md">
      <Card>
        <CardHeader className="text-center">
          <Users className="mx-auto h-12 w-12 text-primary" />
          <CardTitle className="mt-4">Team Invitation</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join a team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold text-lg">{invitation.team.name}</h3>
              {invitation.team.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {invitation.team.description}
                </p>
              )}
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{invitation.team.memberCount} member{invitation.team.memberCount !== 1 ? 's' : ''}</span>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Your role</span>
                <Badge variant="secondary">
                  {invitation.role.toLowerCase()}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {roleDescriptions[invitation.role]}
              </p>
            </div>

            <Button
              className="w-full"
              onClick={handleAccept}
              disabled={isAccepting}
            >
              {isAccepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Accept Invitation
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              This invitation expires on{' '}
              {new Date(invitation.expiresAt).toLocaleDateString()}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
