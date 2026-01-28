import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// GET - List sessions for a statute context
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const codeAbbr = searchParams.get('codeAbbr');
    const chapterNum = searchParams.get('chapterNum');
    const subchapter = searchParams.get('subchapter');

    if (!codeAbbr || !chapterNum) {
      return NextResponse.json({ error: 'Code and chapter required' }, { status: 400 });
    }

    const sessions = await prisma.statuteChatSession.findMany({
      where: {
        userId: session.user.id,
        codeAbbr,
        chapterNum,
        ...(subchapter ? { subchapter } : { subchapter: null }),
      },
      include: {
        bill: {
          select: {
            billId: true,
            description: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({
      sessions: sessions.map(s => ({
        id: s.id,
        title: s.title,
        codeAbbr: s.codeAbbr,
        chapterNum: s.chapterNum,
        subchapter: s.subchapter,
        bill: s.bill ? { billId: s.bill.billId, description: s.bill.description } : null,
        messageCount: s._count.messages,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error listing statute chat sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new session
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { codeAbbr, chapterNum, subchapter, billId, title } = await request.json();

    if (!codeAbbr || !chapterNum) {
      return NextResponse.json({ error: 'Code and chapter required' }, { status: 400 });
    }

    // Validate bill exists if provided
    let bill = null;
    if (billId) {
      bill = await prisma.bill.findUnique({
        where: { id: billId },
        select: { id: true, billId: true },
      });
      if (!bill) {
        return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
      }
    }

    // Generate default title if not provided
    const defaultTitle = bill
      ? `${bill.billId} & ${codeAbbr} Ch. ${chapterNum}${subchapter ? ` Subch. ${subchapter}` : ''}`
      : `${codeAbbr} Ch. ${chapterNum}${subchapter ? ` Subch. ${subchapter}` : ''}`;

    const chatSession = await prisma.statuteChatSession.create({
      data: {
        userId: session.user.id,
        codeAbbr,
        chapterNum,
        subchapter: subchapter || null,
        billId: bill?.id || null,
        title: title || defaultTitle,
      },
      include: {
        bill: {
          select: {
            billId: true,
            description: true,
          },
        },
      },
    });

    return NextResponse.json({
      session: {
        id: chatSession.id,
        title: chatSession.title,
        codeAbbr: chatSession.codeAbbr,
        chapterNum: chatSession.chapterNum,
        subchapter: chatSession.subchapter,
        bill: chatSession.bill ? { billId: chatSession.bill.billId, description: chatSession.bill.description } : null,
        createdAt: chatSession.createdAt.toISOString(),
        updatedAt: chatSession.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating statute chat session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
