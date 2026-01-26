'use client';

import { useTeams } from '@/hooks/use-teams';
import { TeamCard } from '@/components/teams/team-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Users } from 'lucide-react';
import Link from 'next/link';

export default function TeamsPage() {
  const { teams, isLoading, isError } = useTeams();

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-shrink-0 p-6 pb-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Teams</h1>
              <p className="text-muted-foreground mt-1">
                Collaborate with your team on bill analysis
              </p>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-shrink-0 p-6 pb-0">
          <h1 className="text-3xl font-bold">Teams</h1>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="text-center">
            <p className="text-destructive">Failed to load teams</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Fixed header */}
      <div className="flex-shrink-0 p-6 pb-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Teams</h1>
            <p className="text-muted-foreground mt-1">
              Collaborate with your team on bill analysis
            </p>
          </div>
          <Link href="/teams/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Team
            </Button>
          </Link>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {teams.length === 0 ? (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No teams yet</h3>
            <p className="mt-2 text-muted-foreground">
              Create a team to start collaborating with others on bill analysis.
            </p>
            <Link href="/teams/new">
              <Button className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Team
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
