import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const billId = searchParams.get('billId');

    if (!billId) {
      return new NextResponse('billId query parameter is required', { status: 400 });
    }

    // Find the bill by billId string
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { id: true },
    });

    if (!bill) {
      return new NextResponse('Bill not found', { status: 404 });
    }

    // Find the chat session for this user and bill
    const chatSession = await prisma.chatSession.findUnique({
      where: {
        userId_billId: {
          userId: session.user.id,
          billId: bill.id,
        },
      },
    });

    if (!chatSession) {
      // No session to clear, return success anyway
      return NextResponse.json({ success: true, message: 'No chat session found' });
    }

    // Delete all messages in the chat session
    // Messages cascade delete from the session, but we can also delete just the messages
    // to preserve the session record. Let's delete the messages only.
    await prisma.chatMessage.deleteMany({
      where: {
        chatSessionId: chatSession.id,
      },
    });

    return NextResponse.json({ success: true, message: 'Chat session cleared' });
  } catch (error) {
    console.error('Error clearing chat session:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
