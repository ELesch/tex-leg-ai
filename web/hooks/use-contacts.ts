'use client';

import useSWR from 'swr';
import { Chamber, StaffRole } from '@prisma/client';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('Failed to fetch contacts');
    throw error;
  }
  return res.json();
};

// Types for Contact
export interface ContactAuthor {
  id: string;
  name: string;
  displayName: string | null;
  chamber: Chamber | null;
}

export interface ContactStaffPosition {
  id: string;
  position: StaffRole;
  customPosition: string | null;
  isPrimary: boolean;
  author: ContactAuthor;
}

export interface ContactSummary {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  mobilePhone: string | null;
  address: string | null;
  title: string | null;
  organization: string | null;
  createdAt: string;
  updatedAt: string;
  noteCount: number;
  sharedCount: number;
  staffPositions: ContactStaffPosition[];
}

interface UseContactsOptions {
  search?: string;
  authorId?: string;
  limit?: number;
  offset?: number;
}

export function useContacts(options: UseContactsOptions = {}) {
  const { search, authorId, limit = 50, offset = 0 } = options;

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (authorId) params.set('authorId', authorId);
  params.set('limit', String(limit));
  params.set('offset', String(offset));

  const url = `/api/contacts?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<{
    contacts: ContactSummary[];
    total: number;
    limit: number;
    offset: number;
  }>(url, fetcher, {
    revalidateOnFocus: false,
  });

  return {
    contacts: data?.contacts ?? [],
    total: data?.total ?? 0,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

// Types for Contact Details
export interface ContactNoteUser {
  id: string;
  name: string | null;
  email: string;
}

export interface ContactNote {
  id: string;
  content: string;
  mentions: Array<{
    type: 'bill' | 'author' | 'contact';
    id: string;
    displayText: string;
  }> | null;
  createdAt: string;
  updatedAt: string;
  user: ContactNoteUser;
}

export interface ContactSharedTeam {
  id: string;
  team: {
    id: string;
    name: string;
    slug: string;
  };
  sharedAt: string;
}

export interface ContactStaffPositionDetail {
  id: string;
  position: StaffRole;
  customPosition: string | null;
  isPrimary: boolean;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  author: {
    id: string;
    name: string;
    displayName: string | null;
    chamber: Chamber | null;
    district: string | null;
    party: string | null;
  };
}

export interface ContactDetails extends ContactSummary {
  staffPositionCount: number;
  staffPositions: ContactStaffPositionDetail[];
  recentNotes: ContactNote[];
  sharedWith: ContactSharedTeam[];
}

export function useContact(contactId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ contact: ContactDetails }>(
    contactId ? `/api/contacts/${contactId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    contact: data?.contact ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

// Contact notes hook
interface UseContactNotesOptions {
  limit?: number;
  offset?: number;
}

export function useContactNotes(
  contactId: string | null,
  options: UseContactNotesOptions = {}
) {
  const { limit = 20, offset = 0 } = options;

  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));

  const url = contactId ? `/api/contacts/${contactId}/notes?${params.toString()}` : null;

  const { data, error, isLoading, mutate } = useSWR<{
    notes: ContactNote[];
    total: number;
    limit: number;
    offset: number;
  }>(url, fetcher, {
    revalidateOnFocus: false,
  });

  return {
    notes: data?.notes ?? [],
    total: data?.total ?? 0,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
