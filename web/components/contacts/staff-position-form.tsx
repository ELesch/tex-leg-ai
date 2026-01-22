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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { StaffRole } from '@prisma/client';
import { staffRoleConfig } from './staff-position-badge';
import { Loader2 } from 'lucide-react';

interface ContactSummary {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  staffPositions: Array<{
    id: string;
    position: StaffRole;
    author: { id: string };
  }>;
}

interface StaffPositionFormProps {
  open: boolean;
  onClose: () => void;
  authorId: string;
  authorName: string;
  contacts: ContactSummary[];
  positionId?: string;
  initialData?: {
    contactId: string;
    position: StaffRole;
    customPosition?: string;
    isPrimary?: boolean;
    startDate?: string;
    endDate?: string;
  };
}

export function StaffPositionForm({
  open,
  onClose,
  authorId,
  authorName,
  contacts,
  positionId,
  initialData,
}: StaffPositionFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contactId, setContactId] = useState(initialData?.contactId || '');
  const [position, setPosition] = useState<StaffRole | ''>(
    initialData?.position || ''
  );
  const [customPosition, setCustomPosition] = useState(
    initialData?.customPosition || ''
  );
  const [isPrimary, setIsPrimary] = useState(initialData?.isPrimary || false);
  const [startDate, setStartDate] = useState(initialData?.startDate || '');
  const [endDate, setEndDate] = useState(initialData?.endDate || '');

  const isEditing = !!positionId;

  // Filter contacts that don't already have this position for this author
  const availableContacts = contacts.filter((c) => {
    if (isEditing && c.id === initialData?.contactId) return true;
    return !c.staffPositions.some(
      (sp) =>
        sp.author.id === authorId &&
        sp.position === position &&
        sp.id !== positionId
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contactId) {
      toast({
        title: 'Validation error',
        description: 'Please select a contact.',
        variant: 'destructive',
      });
      return;
    }

    if (!position) {
      toast({
        title: 'Validation error',
        description: 'Please select a position.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing) {
        // Update existing position
        const res = await fetch(`/api/contacts/${contactId}/positions`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            positionId,
            customPosition:
              position === 'OTHER' ? customPosition.trim() : undefined,
            isPrimary,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update position');
        }
      } else {
        // Create new position
        const res = await fetch(`/api/contacts/${contactId}/positions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            authorId,
            position,
            customPosition:
              position === 'OTHER' ? customPosition.trim() : undefined,
            isPrimary,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create position');
        }
      }

      toast({
        title: isEditing ? 'Position updated' : 'Position added',
        description: isEditing
          ? 'The staff position has been updated.'
          : 'The staff position has been added.',
      });

      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save position',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getContactDisplayName = (contact: ContactSummary) => {
    return (
      contact.displayName || `${contact.firstName} ${contact.lastName}`
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Staff Position' : 'Add Staff Position'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update position for ${authorName}`
              : `Link a contact to ${authorName} as a staff member`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contact">Contact *</Label>
            <Select
              value={contactId}
              onValueChange={setContactId}
              disabled={isEditing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a contact" />
              </SelectTrigger>
              <SelectContent>
                {availableContacts.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No contacts available.
                    <br />
                    Create a new contact first.
                  </div>
                ) : (
                  availableContacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      <div className="flex flex-col">
                        <span>{getContactDisplayName(contact)}</span>
                        {contact.email && (
                          <span className="text-xs text-muted-foreground">
                            {contact.email}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Position *</Label>
            <Select
              value={position}
              onValueChange={(val) => setPosition(val as StaffRole)}
              disabled={isEditing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a position" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(staffRoleConfig)
                  .sort((a, b) => a[1].priority - b[1].priority)
                  .map(([role, config]) => (
                    <SelectItem key={role} value={role}>
                      {config.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {position === 'OTHER' && (
            <div className="space-y-2">
              <Label htmlFor="customPosition">Custom Position Title</Label>
              <Input
                id="customPosition"
                value={customPosition}
                onChange={(e) => setCustomPosition(e.target.value)}
                placeholder="Enter position title"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPrimary"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="rounded border-gray-300"
            />
            <Label htmlFor="isPrimary" className="text-sm font-normal">
              Primary contact for this office
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !contactId || !position}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Add Position'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
