'use client';

import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('Failed to search mentions');
    throw error;
  }
  return res.json();
};

export type MentionType = 'bill' | 'author' | 'contact' | 'all';

export interface MentionResult {
  type: 'bill' | 'author' | 'contact';
  id: string;
  displayText: string;
  subtext?: string;
}

interface UseMentionsSearchOptions {
  type?: MentionType;
  limit?: number;
}

export function useMentionsSearch(
  query: string | null,
  options: UseMentionsSearchOptions = {}
) {
  const { type = 'all', limit = 10 } = options;

  // Only search if query is at least 1 character
  const shouldFetch = query && query.length >= 1;

  const params = new URLSearchParams();
  if (query) params.set('q', query);
  params.set('type', type);
  params.set('limit', String(limit));

  const url = shouldFetch ? `/api/mentions/search?${params.toString()}` : null;

  const { data, error, isLoading, mutate } = useSWR<{ mentions: MentionResult[] }>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300, // Debounce rapid searches
    }
  );

  return {
    mentions: data?.mentions ?? [],
    isLoading: shouldFetch ? isLoading : false,
    isError: !!error,
    error,
    mutate,
  };
}

// Parse mentions from text content
export function parseMentions(
  content: string
): Array<{ type: 'bill' | 'author' | 'contact'; id: string; displayText: string }> {
  const mentions: Array<{ type: 'bill' | 'author' | 'contact'; id: string; displayText: string }> =
    [];

  // Match @[displayText](type:id) format
  const mentionRegex = /@\[([^\]]+)\]\((\w+):([^)]+)\)/g;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    const [, displayText, type, id] = match;
    if (['bill', 'author', 'contact'].includes(type)) {
      mentions.push({
        displayText,
        type: type as 'bill' | 'author' | 'contact',
        id,
      });
    }
  }

  return mentions;
}

// Format mentions for display (convert @[text](type:id) to just the display text)
export function formatMentionsForDisplay(content: string): string {
  return content.replace(/@\[([^\]]+)\]\(\w+:[^)]+\)/g, '@$1');
}

// Create mention markup
export function createMentionMarkup(
  type: 'bill' | 'author' | 'contact',
  id: string,
  displayText: string
): string {
  return `@[${displayText}](${type}:${id})`;
}
