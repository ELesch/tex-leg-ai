import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { SyncJobStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/sync/statutes - Get current statute sync job status
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get the most recent sync job
    const job = await prisma.statuteSyncJob.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    // Get code statistics
    const codes = await prisma.texasCode.findMany({
      select: {
        abbreviation: true,
        name: true,
        sectionCount: true,
        lastSyncedAt: true,
      },
      orderBy: { abbreviation: 'asc' },
    });

    const totalSections = await prisma.statute.count({
      where: { isCurrent: true },
    });

    return NextResponse.json({
      job,
      stats: {
        totalCodes: codes.length,
        totalSections,
        codes,
      },
    });
  } catch (error) {
    console.error('Error getting statute sync status:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/sync/statutes - Control statute sync job
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action as string;

    switch (action) {
      case 'start': {
        // Check for existing running job
        const existingJob = await prisma.statuteSyncJob.findFirst({
          where: { status: SyncJobStatus.RUNNING },
        });

        if (existingJob) {
          return NextResponse.json(
            { error: 'A sync job is already running' },
            { status: 409 }
          );
        }

        // Create new sync job
        const job = await prisma.statuteSyncJob.create({
          data: {
            status: SyncJobStatus.PENDING,
            currentCode: body.code || null,
          },
        });

        return NextResponse.json({
          job,
          message: 'Sync job created. Run `npx tsx scripts/sync-statutes.ts` to execute.',
        });
      }

      case 'stop': {
        if (!body.jobId) {
          return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
        }

        const job = await prisma.statuteSyncJob.update({
          where: { id: body.jobId },
          data: {
            status: SyncJobStatus.STOPPED,
            completedAt: new Date(),
          },
        });

        return NextResponse.json({ job, message: 'Sync job stopped' });
      }

      case 'clear': {
        // Clear all completed/stopped/error jobs
        await prisma.statuteSyncJob.deleteMany({
          where: {
            status: { in: [SyncJobStatus.COMPLETED, SyncJobStatus.STOPPED, SyncJobStatus.ERROR] },
          },
        });

        return NextResponse.json({ message: 'Old sync jobs cleared' });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error with statute sync action:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to perform action' },
      { status: 500 }
    );
  }
}
