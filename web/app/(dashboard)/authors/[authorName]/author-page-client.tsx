'use client';

import { ContactsPanel } from '@/components/contacts';

interface AuthorPageClientProps {
  authorId: string;
  authorName: string;
}

export function AuthorPageClient({ authorId, authorName }: AuthorPageClientProps) {
  return (
    <ContactsPanel
      authorId={authorId}
      authorName={authorName}
      className="sticky top-4"
    />
  );
}
