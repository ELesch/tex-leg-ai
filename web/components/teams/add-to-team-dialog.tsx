'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useTeams } from '@/hooks/use-teams';
import { addBillToWorkspace } from '@/hooks/use-workspaces';
import { useToast } from '@/hooks/use-toast';
import { Users, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import { WorkspacePriority } from '@prisma/client';

interface AddToTeamDialogProps {
  billId: string;
  billDescription: string;
  trigger?: React.ReactNode;
}

export function AddToTeamDialog({
  billId,
  billDescription,
  trigger,
}: AddToTeamDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { teams, isLoading: teamsLoading } = useTeams();
  const [open, setOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [priority, setPriority] = useState<WorkspacePriority>('MEDIUM');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter to teams where user can create workspaces (CONTRIBUTOR or higher)
  const eligibleTeams = teams.filter(
    (t) => t.role !== 'VIEWER' && t.role !== 'REVIEWER'
  );

  const handleSubmit = async () => {
    if (!selectedTeam) return;

    setIsSubmitting(true);
    try {
      const team = teams.find((t) => t.id === selectedTeam);
      await addBillToWorkspace(selectedTeam, billId, { priority });

      toast({
        title: 'Added to team workspace',
        description: `${billId} has been added to ${team?.name || 'the team'}.`,
      });

      setOpen(false);

      // Navigate to the team workspace
      if (team) {
        router.push(`/teams/${team.slug}/bills/${billId}`);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add bill to team',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Users className="mr-2 h-4 w-4" />
            Add to Team
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Team Workspace</DialogTitle>
          <DialogDescription>
            Add {billId} to a team workspace for collaborative review.
          </DialogDescription>
        </DialogHeader>

        {teamsLoading ? (
          <div className="py-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : eligibleTeams.length === 0 ? (
          <div className="py-6 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">
              You&apos;re not a contributor in any teams yet.
            </p>
            <Link href="/teams/new">
              <Button className="mt-4" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Create a Team
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Team</Label>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a team" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as WorkspacePriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4">
              <Button
                onClick={handleSubmit}
                disabled={!selectedTeam || isSubmitting}
                className="w-full"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add to Workspace
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
