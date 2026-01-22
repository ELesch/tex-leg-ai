'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTeams } from '@/hooks/use-teams';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users } from 'lucide-react';

interface ShareContactDialogProps {
  open: boolean;
  onClose: () => void;
  contactId: string;
  contactName: string;
  sharedTeamIds: string[];
}

export function ShareContactDialog({
  open,
  onClose,
  contactId,
  contactName,
  sharedTeamIds,
}: ShareContactDialogProps) {
  const { toast } = useToast();
  const { teams, isLoading: isLoadingTeams } = useTeams();
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter out teams that already have this contact shared
  const availableTeams = teams.filter((t) => !sharedTeamIds.includes(t.id));

  const handleShare = async () => {
    if (!selectedTeamId) {
      toast({
        title: 'Validation error',
        description: 'Please select a team.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/contacts/${contactId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: selectedTeamId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to share contact');
      }

      const selectedTeam = teams.find((t) => t.id === selectedTeamId);
      toast({
        title: 'Contact shared',
        description: `${contactName} has been shared with ${selectedTeam?.name}.`,
      });

      setSelectedTeamId('');
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to share contact',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Share Contact</DialogTitle>
          <DialogDescription>
            Share {contactName} with a team. Team members will be able to see the
            contact information but not your private notes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoadingTeams ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : availableTeams.length === 0 ? (
            <div className="text-center py-4">
              <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {teams.length === 0
                  ? 'You are not a member of any teams.'
                  : 'This contact has already been shared with all your teams.'}
              </p>
            </div>
          ) : (
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a team" />
              </SelectTrigger>
              <SelectContent>
                {availableTeams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    <div className="flex flex-col">
                      <span>{team.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {team.memberCount} members
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleShare}
            disabled={isSubmitting || !selectedTeamId || availableTeams.length === 0}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Share Contact
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
