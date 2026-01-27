import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

interface RouteParams {
  params: Promise<{ followedBillId: string }>;
}

// GET /api/notifications/bills/[followedBillId] - Get notification settings for a followed bill
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { followedBillId } = await params;

    // Verify the followed bill belongs to the user
    const followedBill = await prisma.followedBill.findFirst({
      where: {
        id: followedBillId,
        userId: session.user.id,
      },
    });

    if (!followedBill) {
      return NextResponse.json({ error: 'Followed bill not found' }, { status: 404 });
    }

    const notification = await prisma.billNotification.findUnique({
      where: { followedBillId },
    });

    return NextResponse.json({ notification });
  } catch (error) {
    console.error('Error fetching bill notification settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/notifications/bills/[followedBillId] - Enable notifications for a followed bill
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { followedBillId } = await params;
    const body = await request.json();
    const {
      statusChange = true,
      newAction = true,
      newVersion = true,
      hearingScheduled = true,
      voteRecorded = true,
    } = body;

    // Verify the followed bill belongs to the user
    const followedBill = await prisma.followedBill.findFirst({
      where: {
        id: followedBillId,
        userId: session.user.id,
      },
    });

    if (!followedBill) {
      return NextResponse.json({ error: 'Followed bill not found' }, { status: 404 });
    }

    // Check if notification already exists
    const existing = await prisma.billNotification.findUnique({
      where: { followedBillId },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Notification settings already exist' },
        { status: 409 }
      );
    }

    const notification = await prisma.billNotification.create({
      data: {
        userId: session.user.id,
        followedBillId,
        enabled: true,
        statusChange,
        newAction,
        newVersion,
        hearingScheduled,
        voteRecorded,
      },
    });

    return NextResponse.json({ notification }, { status: 201 });
  } catch (error) {
    console.error('Error creating bill notification settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications/bills/[followedBillId] - Update notification settings for a bill
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { followedBillId } = await params;
    const body = await request.json();
    const {
      enabled,
      statusChange,
      newAction,
      newVersion,
      hearingScheduled,
      voteRecorded,
    } = body;

    // Verify the followed bill belongs to the user
    const followedBill = await prisma.followedBill.findFirst({
      where: {
        id: followedBillId,
        userId: session.user.id,
      },
    });

    if (!followedBill) {
      return NextResponse.json({ error: 'Followed bill not found' }, { status: 404 });
    }

    const notification = await prisma.billNotification.update({
      where: { followedBillId },
      data: {
        ...(enabled !== undefined && { enabled }),
        ...(statusChange !== undefined && { statusChange }),
        ...(newAction !== undefined && { newAction }),
        ...(newVersion !== undefined && { newVersion }),
        ...(hearingScheduled !== undefined && { hearingScheduled }),
        ...(voteRecorded !== undefined && { voteRecorded }),
      },
    });

    return NextResponse.json({ notification });
  } catch (error) {
    console.error('Error updating bill notification settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications/bills/[followedBillId] - Remove notification settings for a bill
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { followedBillId } = await params;

    // Verify the followed bill belongs to the user
    const followedBill = await prisma.followedBill.findFirst({
      where: {
        id: followedBillId,
        userId: session.user.id,
      },
    });

    if (!followedBill) {
      return NextResponse.json({ error: 'Followed bill not found' }, { status: 404 });
    }

    await prisma.billNotification.delete({
      where: { followedBillId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bill notification settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
