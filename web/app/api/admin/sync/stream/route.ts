import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { syncBillsWithProgress, SyncEventType, SyncOptions } from '@/lib/admin/sync/bill-sync-stream';
import { BillType } from '@prisma/client';

// POST /api/admin/sync/stream - Stream sync progress via SSE
export async function POST(request: NextRequest) {
  // Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (session.user.role !== 'ADMIN') {
    return new Response('Forbidden', { status: 403 });
  }

  // Parse request body for options
  let options: SyncOptions = {};
  try {
    const body = await request.json().catch(() => ({}));
    options = {
      maxBills: body.maxBills,
      billTypes: body.billTypes as BillType[] | undefined,
      syncUntilComplete: body.syncUntilComplete,
    };
  } catch {
    // Use defaults
  }

  const encoder = new TextEncoder();

  // Create abort signal that can be checked by the sync process
  const abortSignal = { aborted: false };

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: SyncEventType, data: unknown) => {
        try {
          const formattedEvent = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(formattedEvent));
        } catch (error) {
          console.error('Error sending SSE event:', error);
        }
      };

      try {
        await syncBillsWithProgress({ ...options, abortSignal }, sendEvent);
      } catch (error) {
        console.error('Sync stream error:', error);
        sendEvent('error', {
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        controller.close();
      }
    },
    cancel() {
      // When the client closes the connection, mark as aborted
      abortSignal.aborted = true;
      console.log('Sync stream cancelled by client');
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
