export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';

// Zod schema for request validation
const searchRequestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  code: z.string().optional(),
  chapter: z.string().optional(),
  limit: z.number().int().min(1).max(20).default(10),
});

interface SemanticSearchResult {
  id: string;
  codeAbbr: string;
  codeName: string;
  chapterNum: string;
  chapterTitle: string | null;
  subchapter: string | null;
  sectionNum: string;
  heading: string | null;
  snippet: string;
  relevanceScore: number;
  relevanceExplanation: string;
}

// POST /api/statutes/semantic-search - AI-powered semantic search
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const parseResult = searchRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { query, code, chapter, limit } = parseResult.data;

    // Get API key from user settings or environment
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { aiApiKey: true, aiProvider: true },
    });

    const apiKey = user?.aiApiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'No API key configured. Please configure an AI provider in settings.' },
        { status: 400 }
      );
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

    // Fetch candidate statutes (limit to prevent token overflow)
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
      take: 200, // Limit candidates to analyze
    });

    if (statutes.length === 0) {
      return NextResponse.json({
        query,
        results: [],
        message: 'No statutes found matching the filters',
      });
    }

    // Prepare statute summaries for AI analysis
    const statuteSummaries = statutes.map((s, idx) => ({
      index: idx,
      id: s.id,
      code: s.code.abbreviation,
      section: s.sectionNum,
      heading: s.heading || 'Untitled',
      snippet: s.text.slice(0, 500) + (s.text.length > 500 ? '...' : ''),
    }));

    // Create Anthropic client
    const client = new Anthropic({ apiKey });

    // Use AI to find semantically relevant statutes
    const aiResponse = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `You are analyzing Texas statutes to find sections relevant to a user's query.

User Query: "${query}"

Here are statute sections to analyze (format: [index] CODE Section: HEADING - Snippet):

${statuteSummaries.map(s => `[${s.index}] ${s.code} ${s.section}: ${s.heading} - ${s.snippet}`).join('\n\n')}

Task: Identify the ${limit} most relevant statute sections for the user's query. Consider:
1. Direct subject matter match
2. Related concepts that would affect the query topic
3. Procedural sections that govern how the topic is handled
4. Definitions that clarify terms used in the query

Return your response as a JSON array with this exact format (no markdown, just JSON):
[
  {
    "index": <number>,
    "score": <1-10>,
    "explanation": "<brief explanation of relevance>"
  }
]

Only include sections with relevance score >= 5. Order by score descending.`,
        },
      ],
    });

    // Parse AI response
    let relevantIndices: { index: number; score: number; explanation: string }[] = [];

    const responseText = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : '';

    try {
      // Extract JSON from response (handle potential markdown code blocks)
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        relevantIndices = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError, responseText);
      // Fall back to empty results if parsing fails
    }

    // Map back to full results
    const results: SemanticSearchResult[] = relevantIndices
      .filter(r => r.index >= 0 && r.index < statutes.length)
      .slice(0, limit)
      .map(r => {
        const statute = statutes[r.index];
        return {
          id: statute.id,
          codeAbbr: statute.code.abbreviation,
          codeName: statute.code.name,
          chapterNum: statute.chapterNum,
          chapterTitle: statute.chapterTitle,
          subchapter: statute.subchapter,
          sectionNum: statute.sectionNum,
          heading: statute.heading,
          snippet: statute.text.slice(0, 300) + (statute.text.length > 300 ? '...' : ''),
          relevanceScore: r.score,
          relevanceExplanation: r.explanation,
        };
      });

    return NextResponse.json({
      query,
      filters: { code, chapter },
      totalCandidates: statutes.length,
      results,
    });
  } catch (error) {
    console.error('Error in semantic search:', error);

    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { error: 'Invalid API key. Please check your AI settings.' },
          { status: 401 }
        );
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
