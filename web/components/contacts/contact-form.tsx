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
import { Textarea } from '@/components/ui/textarea';
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

interface ContactFormProps {
  open: boolean;
  onClose: () => void;
  authorId?: string;
  authorName?: string;
  contactId?: string;
  initialData?: {
    firstName: string;
    lastName: string;
    displayName?: string;
    email?: string;
    phone?: string;
    mobilePhone?: string;
    address?: string;
    title?: string;
    organization?: string;
  };
}

export function ContactForm({
  open,
  onClose,
  authorId,
  authorName,
  contactId,
  initialData,
}: ContactFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    displayName: initialData?.displayName || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    mobilePhone: initialData?.mobilePhone || '',
    address: initialData?.address || '',
    title: initialData?.title || '',
    organization: initialData?.organization || '',
  });

  // Staff position fields (only used when creating with author)
  const [staffPosition, setStaffPosition] = useState<StaffRole | ''>('');
  const [customPosition, setCustomPosition] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

  const isEditing = !!contactId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast({
        title: 'Validation error',
        description: 'First name and last name are required.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create or update contact
      const contactRes = await fetch(
        contactId ? `/api/contacts/${contactId}` : '/api/contacts',
        {
          method: contactId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            displayName: formData.displayName.trim() || undefined,
            email: formData.email.trim() || undefined,
            phone: formData.phone.trim() || undefined,
            mobilePhone: formData.mobilePhone.trim() || undefined,
            address: formData.address.trim() || undefined,
            title: formData.title.trim() || undefined,
            organization: formData.organization.trim() || undefined,
          }),
        }
      );

      if (!contactRes.ok) {
        const err = await contactRes.json();
        throw new Error(err.error || 'Failed to save contact');
      }

      const contactData = await contactRes.json();
      const newContactId = contactData.contact.id;

      // If creating a new contact and author is specified, create staff position
      if (!contactId && authorId && staffPosition) {
        const positionRes = await fetch(
          `/api/contacts/${newContactId}/positions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              authorId,
              position: staffPosition,
              customPosition:
                staffPosition === 'OTHER' ? customPosition.trim() : undefined,
              isPrimary,
            }),
          }
        );

        if (!positionRes.ok) {
          console.error('Failed to create staff position');
          // Don't fail the whole operation, just log
        }
      }

      toast({
        title: isEditing ? 'Contact updated' : 'Contact created',
        description: isEditing
          ? 'The contact has been updated.'
          : 'The contact has been created.',
      });

      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save contact',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
          <DialogDescription>
            {authorName
              ? `Add a staff contact for ${authorName}`
              : isEditing
              ? 'Update contact information'
              : 'Create a new contact'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="John"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Doe"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              name="displayName"
              value={formData.displayName}
              onChange={handleChange}
              placeholder="Optional nickname or preferred name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Chief of Staff"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organization">Organization</Label>
              <Input
                id="organization"
                name="organization"
                value={formData.organization}
                onChange={handleChange}
                placeholder="Office of Rep. Smith"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="john.doe@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                placeholder="(512) 555-0100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobilePhone">Mobile</Label>
              <Input
                id="mobilePhone"
                name="mobilePhone"
                type="tel"
                value={formData.mobilePhone}
                onChange={handleChange}
                placeholder="(512) 555-0101"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="123 Main St&#10;Austin, TX 78701"
              rows={2}
            />
          </div>

          {/* Staff position selector (only for new contacts with author) */}
          {!isEditing && authorId && (
            <div className="pt-4 border-t space-y-4">
              <p className="text-sm font-medium">Staff Position (optional)</p>
              <div className="space-y-2">
                <Label htmlFor="staffPosition">Position</Label>
                <Select
                  value={staffPosition}
                  onValueChange={(val) => setStaffPosition(val as StaffRole)}
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

              {staffPosition === 'OTHER' && (
                <div className="space-y-2">
                  <Label htmlFor="customPosition">Custom Position</Label>
                  <Input
                    id="customPosition"
                    value={customPosition}
                    onChange={(e) => setCustomPosition(e.target.value)}
                    placeholder="Enter position title"
                  />
                </div>
              )}

              {staffPosition && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPrimary"
                    checked={isPrimary}
                    onChange={(e) => setIsPrimary(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="isPrimary" className="text-sm font-normal">
                    Primary contact for this position
                  </Label>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
