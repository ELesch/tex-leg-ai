'use client';

import useSWR from 'swr';
import { Chamber, StaffRole } from '@prisma/client';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('Failed to fetch author');
    throw error;
  }
  return res.json();
};

// Types for Author
export interface AuthorSummary {
  id: string;
  name: string;
  displayName: string | null;
  chamber: Chamber | null;
  district: string | null;
  party: string | null;
  email: string | null;
  phone: string | null;
  officeAddress: string | null;
  capitolOffice: string | null;
  websiteUrl: string | null;
  photoUrl: string | null;
  staffCount: number;
  userContactCount: number;
}

interface UseAuthorsOptions {
  search?: string;
  chamber?: Chamber;
  limit?: number;
  offset?: number;
}

export function useAuthors(options: UseAuthorsOptions = {}) {
  const { search, chamber, limit = 50, offset = 0 } = options;

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (chamber) params.set('chamber', chamber);
  params.set('limit', String(limit));
  params.set('offset', String(offset));

  const url = `/api/authors?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<{
    authors: AuthorSummary[];
    total: number;
    limit: number;
    offset: number;
  }>(url, fetcher, {
    revalidateOnFocus: false,
  });

  return {
    authors: data?.authors ?? [],
    total: data?.total ?? 0,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

// Types for Author Details
export interface AuthorStaffContact {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
}

export interface AuthorStaffPosition {
  id: string;
  position: StaffRole;
  customPosition: string | null;
  isPrimary: boolean;
  contact: AuthorStaffContact;
}

export interface AuthorUserContact {
  id: string;
  personalEmail: string | null;
  personalPhone: string | null;
  personalNotes: string | null;
}

export interface AuthorDetails extends AuthorSummary {
  createdAt: string;
  updatedAt: string;
  staff: AuthorStaffPosition[];
  userContact: AuthorUserContact | null;
}

export function useAuthor(authorId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ author: AuthorDetails }>(
    authorId ? `/api/authors/${authorId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    author: data?.author ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

export function useAuthorByName(name: string | null) {
  const encodedName = name ? encodeURIComponent(name) : null;

  const { data, error, isLoading, mutate } = useSWR<{ author: AuthorDetails }>(
    encodedName ? `/api/authors/by-name/${encodedName}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    author: data?.author ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

// Types for User Contact with Author
export interface UserContactNote {
  id: string;
  content: string;
  mentions: Array<{
    type: 'bill' | 'author' | 'contact';
    id: string;
    displayText: string;
  }> | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

export interface UserContactWithAuthor {
  id: string;
  personalEmail: string | null;
  personalPhone: string | null;
  personalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  noteCount: number;
  recentNotes: UserContactNote[];
}

export interface AuthorWithUserContact {
  id: string;
  name: string;
  displayName: string | null;
  chamber: Chamber | null;
  district: string | null;
  party: string | null;
  email: string | null;
  phone: string | null;
  officeAddress: string | null;
  capitolOffice: string | null;
  websiteUrl: string | null;
  photoUrl: string | null;
}

export function useUserContact(authorId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{
    author: AuthorWithUserContact;
    userContact: UserContactWithAuthor | null;
  }>(authorId ? `/api/user-contacts/${authorId}` : null, fetcher, {
    revalidateOnFocus: false,
  });

  return {
    author: data?.author ?? null,
    userContact: data?.userContact ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

// User contact notes hook
interface UseUserContactNotesOptions {
  limit?: number;
  offset?: number;
}

export function useUserContactNotes(
  authorId: string | null,
  options: UseUserContactNotesOptions = {}
) {
  const { limit = 20, offset = 0 } = options;

  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));

  const url = authorId ? `/api/user-contacts/${authorId}/notes?${params.toString()}` : null;

  const { data, error, isLoading, mutate } = useSWR<{
    notes: UserContactNote[];
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
