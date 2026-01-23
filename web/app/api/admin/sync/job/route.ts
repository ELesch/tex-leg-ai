import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getActiveSyncJob,
  createSyncJob,
  pauseSyncJob,
  resumeSyncJob,
  stopSyncJob,
  processSyncBatch,
} from '@/lib/admin/sync/sync-job';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for batch processing

// GET /api/admin/sync/job - Get current sync job status
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const job = await getActiveSyncJob();
    return NextResponse.json({ job });
  } catch (error) {
    console.error('Error getting sync job:', error);
    return NextResponse.json(
      { error: 'Failed to get sync job' },
      { status: 500 }
    );
  }
}

// POST /api/admin/sync/job - Create new sync job or perform action
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
        const job = await createSyncJob();
        return NextResponse.json({ job, message: 'Sync job started' });
      }

      case 'pause': {
        if (!body.jobId) {
          return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
        }
        const job = await pauseSyncJob(body.jobId);
        return NextResponse.json({ job, message: 'Sync job paused' });
      }

      case 'resume': {
        if (!body.jobId) {
          return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
        }
        const job = await resumeSyncJob(body.jobId);
        return NextResponse.json({ job, message: 'Sync job resumed' });
      }

      case 'stop': {
        if (!body.jobId) {
          return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
        }
        const job = await stopSyncJob(body.jobId);
        return NextResponse.json({ job, message: 'Sync job stopped' });
      }

      case 'process': {
        if (!body.jobId) {
          return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
        }
        const result = await processSyncBatch(body.jobId);
        const job = await getActiveSyncJob();
        return NextResponse.json({ job, batch: result });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error with sync job action:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to perform action' },
      { status: 500 }
    );
  }
}
