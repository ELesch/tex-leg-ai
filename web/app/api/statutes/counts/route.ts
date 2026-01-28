import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// GET /api/statutes/counts?code=ED&chapter=29&subchapter=A&section=29.001
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const chapter = searchParams.get('chapter');
    const subchapter = searchParams.get('subchapter');
    const section = searchParams.get('section');

    if (!code) {
      return NextResponse.json({ error: 'Code required' }, { status: 400 });
    }

    // Fetch counts in parallel
    const [billsCount, notesCount, chatsCount] = await Promise.all([
      // Bills count - uses BillCodeReference
      fetchBillsCount(code, chapter, subchapter, section),
      // Notes count - requires auth
      userId ? fetchNotesCount(userId, code, chapter, subchapter, section) : 0,
      // Chats count - requires auth
      userId ? fetchChatsCount(userId, code, chapter, subchapter) : 0,
    ]);

    return NextResponse.json({
      bills: billsCount,
      notes: notesCount,
      chats: chatsCount,
    });
  } catch (error) {
    console.error('Error fetching counts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function fetchBillsCount(
  code: string,
  chapter?: string | null,
  subchapter?: string | null,
  section?: string | null
) {
  // Look up code variations
  const codeRecord = await prisma.texasCode.findFirst({
    where: {
      OR: [
        { abbreviation: code.toUpperCase() },
        { name: { contains: code, mode: 'insensitive' } },
      ],
    },
  });

  const codeVariations = [code, code.toUpperCase()];
  if (codeRecord) {
    if (codeRecord.name) codeVariations.push(codeRecord.name);
    if (codeRecord.abbreviation) codeVariations.push(codeRecord.abbreviation);
  }

  // Build where clause
  const where: {
    code: { in: string[]; mode: 'insensitive' };
    OR?: Array<{ chapter?: string } | { chapter?: { startsWith: string } }>;
    subchapter?: { in: string[]; mode: 'insensitive' };
    section?: { in: string[]; mode: 'insensitive' };
  } = {
    code: { in: codeVariations, mode: 'insensitive' },
  };

  if (chapter) {
    where.OR = [
      { chapter: chapter },
      { chapter: `Chapter ${chapter}` },
      { chapter: { startsWith: chapter } },
    ];
  }

  if (subchapter) {
    where.subchapter = {
      in: [subchapter, `Subchapter ${subchapter}`, `Subch. ${subchapter}`],
      mode: 'insensitive',
    };
  }

  if (section) {
    where.section = {
      in: [section, `Section ${section}`],
      mode: 'insensitive',
    };
  }

  const count = await prisma.billCodeReference.count({ where });
  return count;
}

async function fetchNotesCount(
  userId: string,
  code: string,
  chapter?: string | null,
  subchapter?: string | null,
  _section?: string | null
) {
  // For section view, we count notes at any level that includes this context
  // For chapter/subchapter view, we count notes at that specific level

  const where: {
    userId: string;
    codeAbbr: string;
    chapterNum?: string | null;
    subchapter?: string | null;
    sectionNum?: string | null;
  } = {
    userId,
    codeAbbr: code,
  };

  if (chapter) {
    where.chapterNum = chapter;
  }

  if (subchapter) {
    where.subchapter = subchapter;
  }

  // Note: StatuteNote doesn't have sectionNum field based on the schema,
  // it only goes down to subchapter level

  return prisma.statuteNote.count({ where });
}

async function fetchChatsCount(
  userId: string,
  code: string,
  chapter?: string | null,
  subchapter?: string | null
) {
  // Only count chats for chapter/subchapter views
  if (!chapter) return 0;

  const where: {
    userId: string;
    codeAbbr: string;
    chapterNum: string;
    subchapter?: string | null;
  } = {
    userId,
    codeAbbr: code,
    chapterNum: chapter,
  };

  if (subchapter) {
    where.subchapter = subchapter;
  } else {
    where.subchapter = null;
  }

  return prisma.statuteChatSession.count({ where });
}
