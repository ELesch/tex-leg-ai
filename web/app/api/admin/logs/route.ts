import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { getLogs, getLogStats, clearLogs } from '@/lib/logger/log-store';

export const dynamic = 'force-dynamic';

/**
 * Check if the current user is an admin
 */
async function isAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  return user?.role === 'ADMIN';
}

/**
 * GET /api/admin/logs - Fetch logs with filtering
 */
export async function GET(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const level = searchParams.get('level') || undefined;
  const search = searchParams.get('search') || undefined;
  const limit = searchParams.get('limit')
    ? parseInt(searchParams.get('limit')!, 10)
    : 100;
  const after = searchParams.get('after') || undefined;

  const logs = getLogs({ level, search, limit, after });
  const stats = getLogStats();

  return NextResponse.json({
    logs,
    stats,
  });
}

/**
 * DELETE /api/admin/logs - Clear all logs
 */
export async function DELETE() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  clearLogs();

  return NextResponse.json({ success: true });
}
