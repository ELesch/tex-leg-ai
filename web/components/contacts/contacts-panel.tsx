'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { StaffList } from './staff-list';
import { ContactNotesList } from './contact-notes-list';
import { ContactForm } from './contact-form';
import { StaffPositionForm } from './staff-position-form';
import { NoteForm } from './note-form';
import { useUserContact, useUserContactNotes } from '@/hooks/use-author';
import { useContacts } from '@/hooks/use-contacts';
import {
  Mail,
  Phone,
  MapPin,
  Building2,
  Globe,
  ExternalLink,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ContactsPanelProps {
  authorId: string;
  authorName: string;
  className?: string;
}

export function ContactsPanel({ authorId, authorName, className }: ContactsPanelProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('info');
  const [showContactForm, setShowContactForm] = useState(false);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const {
    author,
    userContact,
    isLoading: isLoadingAuthor,
    mutate: mutateUserContact,
  } = useUserContact(authorId);

  const {
    notes,
    total: totalNotes,
    isLoading: isLoadingNotes,
    mutate: mutateNotes,
  } = useUserContactNotes(authorId);

  const {
    contacts,
    isLoading: isLoadingContacts,
    mutate: mutateContacts,
  } = useContacts({ authorId });

  const handleAddNote = () => {
    setEditingNoteId(null);
    setShowNoteForm(true);
  };

  const handleEditNote = (noteId: string) => {
    setEditingNoteId(noteId);
    setShowNoteForm(true);
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const res = await fetch(`/api/user-contacts/${authorId}/notes?noteId=${noteId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete note');
      }

      mutateNotes();
      toast({
        title: 'Note deleted',
        description: 'The note has been deleted.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete the note.',
        variant: 'destructive',
      });
    }
  };

  const handleNoteFormClose = () => {
    setShowNoteForm(false);
    setEditingNoteId(null);
    mutateNotes();
  };

  const handleContactFormClose = () => {
    setShowContactForm(false);
    mutateContacts();
  };

  const handleStaffFormClose = () => {
    setShowStaffForm(false);
    mutateContacts();
    mutateUserContact();
  };

  if (isLoadingAuthor) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!author) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">Author not found</p>
        </CardContent>
      </Card>
    );
  }

  const chamberLabel =
    author.chamber === 'HOUSE'
      ? 'Representative'
      : author.chamber === 'SENATE'
      ? 'Senator'
      : '';

  // Build staff list from contacts that have positions for this author
  const staffList = contacts
    .filter((c) => c.staffPositions.some((sp) => sp.author.id === authorId))
    .flatMap((c) =>
      c.staffPositions
        .filter((sp) => sp.author.id === authorId)
        .map((sp) => ({
          id: sp.id,
          position: sp.position,
          customPosition: sp.customPosition,
          isPrimary: sp.isPrimary,
          contact: {
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            displayName: c.displayName,
            email: c.email,
            phone: c.phone,
            title: c.title,
          },
        }))
    );

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              {author.displayName || author.name}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                mutateUserContact();
                mutateNotes();
                mutateContacts();
              }}
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {chamberLabel && (
            <p className="text-sm text-muted-foreground">
              {chamberLabel}
              {author.district && `, District ${author.district}`}
              {author.party && ` (${author.party})`}
            </p>
          )}
        </CardHeader>

        <CardContent className="pt-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">
                Info
              </TabsTrigger>
              <TabsTrigger value="staff" className="flex-1">
                Staff ({staffList.length})
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex-1">
                Notes ({totalNotes})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-4 space-y-3">
              <AuthorContactInfo author={author} userContact={userContact} />
            </TabsContent>

            <TabsContent value="staff" className="mt-4">
              {isLoadingContacts ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (
                <div className="space-y-3">
                  <StaffList
                    staff={staffList}
                    onAddStaff={() => setShowStaffForm(true)}
                    className="border-0 shadow-none p-0"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowContactForm(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add New Contact
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="mt-4">
              {isLoadingNotes ? (
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : (
                <ContactNotesList
                  notes={notes}
                  onAddNote={handleAddNote}
                  onEditNote={handleEditNote}
                  onDeleteNote={handleDeleteNote}
                  className="border-0 shadow-none p-0"
                  emptyMessage="Add notes about this legislator"
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Modals */}
      <ContactForm
        open={showContactForm}
        onClose={handleContactFormClose}
        authorId={authorId}
        authorName={authorName}
      />

      <StaffPositionForm
        open={showStaffForm}
        onClose={handleStaffFormClose}
        authorId={authorId}
        authorName={authorName}
        contacts={contacts}
      />

      <NoteForm
        open={showNoteForm}
        onClose={handleNoteFormClose}
        authorId={authorId}
        noteId={editingNoteId}
        existingNotes={notes}
      />
    </>
  );
}

interface AuthorContactInfoProps {
  author: {
    email: string | null;
    phone: string | null;
    officeAddress: string | null;
    capitolOffice: string | null;
    websiteUrl: string | null;
  };
  userContact: {
    personalEmail: string | null;
    personalPhone: string | null;
    personalNotes: string | null;
  } | null;
}

function AuthorContactInfo({ author, userContact }: AuthorContactInfoProps) {
  const hasOfficialInfo =
    author.email ||
    author.phone ||
    author.officeAddress ||
    author.capitolOffice ||
    author.websiteUrl;
  const hasPersonalInfo =
    userContact?.personalEmail ||
    userContact?.personalPhone ||
    userContact?.personalNotes;

  if (!hasOfficialInfo && !hasPersonalInfo) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No contact information available
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Official contact info */}
      <div className="space-y-2">
        {author.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
            <a
              href={`mailto:${author.email}`}
              className="text-primary hover:underline truncate"
            >
              {author.email}
            </a>
          </div>
        )}

        {author.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
            <a href={`tel:${author.phone}`} className="text-primary hover:underline">
              {author.phone}
            </a>
          </div>
        )}

        {author.capitolOffice && (
          <div className="flex items-start gap-2 text-sm">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
            <span className="text-muted-foreground">{author.capitolOffice}</span>
          </div>
        )}

        {author.officeAddress && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
            <span className="text-muted-foreground whitespace-pre-line">
              {author.officeAddress}
            </span>
          </div>
        )}

        {author.websiteUrl && (
          <div className="flex items-center gap-2 text-sm">
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            <a
              href={author.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline truncate flex items-center gap-1"
            >
              Website
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>

      {/* Personal/private contact info */}
      {hasPersonalInfo && (
        <div className="pt-3 border-t space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Your Private Notes
          </p>

          {userContact?.personalEmail && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <a
                href={`mailto:${userContact.personalEmail}`}
                className="text-primary hover:underline truncate"
              >
                {userContact.personalEmail}
              </a>
            </div>
          )}

          {userContact?.personalPhone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
              <a
                href={`tel:${userContact.personalPhone}`}
                className="text-primary hover:underline"
              >
                {userContact.personalPhone}
              </a>
            </div>
          )}

          {userContact?.personalNotes && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {userContact.personalNotes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
