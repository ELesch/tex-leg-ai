import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

// GET /api/followed - Get user's followed bills
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const followedBills = await prisma.followedBill.findMany({
      where: { userId: session.user.id },
      include: {
        bill: {
          select: {
            id: true,
            billId: true,
            billType: true,
            billNumber: true,
            description: true,
            status: true,
            lastAction: true,
            lastActionDate: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ followedBills });
  } catch (error) {
    console.error('Error fetching followed bills:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/followed - Follow a bill
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { billId, notes } = await request.json();

    if (!billId) {
      return NextResponse.json(
        { error: 'Bill ID required' },
        { status: 400 }
      );
    }

    // Find the bill
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { id: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Check if already followed
    const existing = await prisma.followedBill.findUnique({
      where: {
        userId_billId: {
          userId: session.user.id,
          billId: bill.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Bill already followed' },
        { status: 409 }
      );
    }

    // Follow the bill
    const followedBill = await prisma.followedBill.create({
      data: {
        userId: session.user.id,
        billId: bill.id,
        notes: notes || null,
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

    return NextResponse.json({ followedBill }, { status: 201 });
  } catch (error) {
    console.error('Error following bill:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/followed - Unfollow a bill
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { billId } = await request.json();

    if (!billId) {
      return NextResponse.json(
        { error: 'Bill ID required' },
        { status: 400 }
      );
    }

    // Find the bill
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { id: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Delete the followed bill
    await prisma.followedBill.delete({
      where: {
        userId_billId: {
          userId: session.user.id,
          billId: bill.id,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unfollowing bill:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
