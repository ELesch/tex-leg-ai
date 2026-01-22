import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const billId = searchParams.get('billId');

    if (!billId) {
      return NextResponse.json({ error: 'billId query parameter is required' }, { status: 400 });
    }

    // First, find the bill by its billId string (e.g., "HB 123")
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { id: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Find the chat session for this user and bill
    const chatSession = await prisma.chatSession.findUnique({
      where: {
        userId_billId: {
          userId: session.user.id,
          billId: bill.id,
        },
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    // If no session exists, return empty messages array
    if (!chatSession) {
      return NextResponse.json({
        sessionId: null,
        messages: [],
      });
    }

    return NextResponse.json({
      sessionId: chatSession.id,
      messages: chatSession.messages,
    });
  } catch (error) {
    console.error('Chat history API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
