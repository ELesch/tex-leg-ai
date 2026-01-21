import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { getSetting } from '@/lib/admin/settings';

// GET /api/admin/sync/status - Get sync status and stats
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [
      totalBills,
      lastSyncedBill,
      billsByType,
      syncEnabled,
      sessionCode,
    ] = await Promise.all([
      prisma.bill.count(),
      prisma.bill.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true, billId: true },
      }),
      prisma.bill.groupBy({
        by: ['billType'],
        _count: { billType: true },
      }),
      getSetting('SYNC_ENABLED'),
      getSetting('SESSION_CODE'),
    ]);

    const status = {
      totalBills,
      lastSyncAt: lastSyncedBill?.updatedAt?.toISOString() ?? null,
      lastSyncedBill: lastSyncedBill?.billId ?? null,
      billsByType: billsByType.reduce(
        (acc, item) => {
          acc[item.billType] = item._count.billType;
          return acc;
        },
        {} as Record<string, number>
      ),
      syncEnabled: syncEnabled === 'true',
      sessionCode: sessionCode ?? '89R',
    };

    return NextResponse.json({ status });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
