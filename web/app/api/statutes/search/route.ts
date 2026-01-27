export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

// Zod schema for search params
const searchParamsSchema = z.object({
  q: z.string().min(1, 'Query is required'),
  code: z.string().optional(),
  chapter: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

interface SearchMatch {
  startOffset: number;
  endOffset: number;
  context: string;
}

interface SearchResult {
  id: string;
  codeAbbr: string;
  codeName: string;
  chapterNum: string;
  chapterTitle: string | null;
  subchapter: string | null;
  sectionNum: string;
  heading: string | null;
  matchCount: number;
  matches: SearchMatch[];
  snippet: string;
}

/**
 * Parse search query supporting AND, OR, NOT operators
 * Examples:
 * - "education" -> simple search
 * - "education AND school" -> both terms required
 * - "education OR training" -> either term
 * - "education NOT federal" -> exclude federal
 */
function parseSearchQuery(query: string): {
  must: string[];
  should: string[];
  mustNot: string[];
} {
  const must: string[] = [];
  const should: string[] = [];
  const mustNot: string[] = [];

  // Split on AND, OR, NOT while preserving quoted phrases
  const tokens = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];

  let currentOperator: 'AND' | 'OR' | 'NOT' | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].replace(/"/g, '').trim();

    if (token.toUpperCase() === 'AND') {
      currentOperator = 'AND';
      continue;
    } else if (token.toUpperCase() === 'OR') {
      currentOperator = 'OR';
      continue;
    } else if (token.toUpperCase() === 'NOT') {
      currentOperator = 'NOT';
      continue;
    }

    if (token) {
      if (currentOperator === 'NOT') {
        mustNot.push(token);
      } else if (currentOperator === 'OR') {
        should.push(token);
      } else {
        // Default (AND) or first term
        must.push(token);
      }
    }

    currentOperator = null;
  }

  // If only should terms (OR query), move first to must
  if (must.length === 0 && should.length > 0) {
    must.push(should.shift()!);
  }

  return { must, should, mustNot };
}

/**
 * Find all matches of search terms in text
 */
function findMatches(text: string, terms: string[]): SearchMatch[] {
  const matches: SearchMatch[] = [];
  const lowerText = text.toLowerCase();

  for (const term of terms) {
    const lowerTerm = term.toLowerCase();
    let index = 0;

    while ((index = lowerText.indexOf(lowerTerm, index)) !== -1) {
      // Get context around the match (50 chars before and after)
      const contextStart = Math.max(0, index - 50);
      const contextEnd = Math.min(text.length, index + term.length + 50);
      let context = text.slice(contextStart, contextEnd);

      // Add ellipsis if truncated
      if (contextStart > 0) context = '...' + context;
      if (contextEnd < text.length) context = context + '...';

      matches.push({
        startOffset: index,
        endOffset: index + term.length,
        context,
      });

      index += term.length;
    }
  }

  // Sort by position
  matches.sort((a, b) => a.startOffset - b.startOffset);

  return matches;
}

/**
 * Check if text matches the search criteria
 */
function matchesSearch(
  text: string,
  { must, should, mustNot }: { must: string[]; should: string[]; mustNot: string[] }
): boolean {
  const lowerText = text.toLowerCase();

  // All must terms must be present
  for (const term of must) {
    if (!lowerText.includes(term.toLowerCase())) {
      return false;
    }
  }

  // Must not have any mustNot terms
  for (const term of mustNot) {
    if (lowerText.includes(term.toLowerCase())) {
      return false;
    }
  }

  // At least one should term must be present (if any)
  if (should.length > 0) {
    const hasShould = should.some(term => lowerText.includes(term.toLowerCase()));
    if (!hasShould) {
      return false;
    }
  }

  return true;
}

// GET /api/statutes/search - Keyword search across statutes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate params
    const parseResult = searchParamsSchema.safeParse({
      q: searchParams.get('q'),
      code: searchParams.get('code'),
      chapter: searchParams.get('chapter'),
      limit: searchParams.get('limit') || 50,
      offset: searchParams.get('offset') || 0,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid search parameters', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { q, code, chapter, limit, offset } = parseResult.data;

    // Parse the search query
    const searchTerms = parseSearchQuery(q);
    const allTerms = [...searchTerms.must, ...searchTerms.should];

    if (allTerms.length === 0) {
      return NextResponse.json({ error: 'No search terms provided' }, { status: 400 });
    }

    // Build the filter
    const filter: {
      isCurrent: boolean;
      code?: { abbreviation: string };
      chapterNum?: string;
    } = {
      isCurrent: true,
    };

    if (code) {
      filter.code = { abbreviation: code };
    }

    if (chapter) {
      filter.chapterNum = chapter;
    }

    // Fetch statutes with basic filtering
    // We'll do the full text search in memory for flexibility with AND/OR/NOT
    const statutes = await prisma.statute.findMany({
      where: filter,
      include: {
        code: {
          select: {
            abbreviation: true,
            name: true,
          },
        },
      },
      orderBy: [
        { code: { abbreviation: 'asc' } },
        { chapterNum: 'asc' },
        { sectionNum: 'asc' },
      ],
    });

    // Filter and score results
    const results: SearchResult[] = [];

    for (const statute of statutes) {
      const searchText = `${statute.heading || ''} ${statute.text}`;

      if (!matchesSearch(searchText, searchTerms)) {
        continue;
      }

      const matches = findMatches(statute.text, allTerms);

      // Create snippet from first match
      let snippet = '';
      if (matches.length > 0) {
        snippet = matches[0].context;
      } else if (statute.text) {
        snippet = statute.text.slice(0, 150) + (statute.text.length > 150 ? '...' : '');
      }

      results.push({
        id: statute.id,
        codeAbbr: statute.code.abbreviation,
        codeName: statute.code.name,
        chapterNum: statute.chapterNum,
        chapterTitle: statute.chapterTitle,
        subchapter: statute.subchapter,
        sectionNum: statute.sectionNum,
        heading: statute.heading,
        matchCount: matches.length,
        matches: matches.slice(0, 10), // Limit matches returned per section
        snippet,
      });
    }

    // Apply pagination
    const totalCount = results.length;
    const paginatedResults = results.slice(offset, offset + limit);

    return NextResponse.json({
      query: q,
      parsedQuery: searchTerms,
      totalCount,
      limit,
      offset,
      results: paginatedResults,
    });
  } catch (error) {
    console.error('Error searching statutes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
