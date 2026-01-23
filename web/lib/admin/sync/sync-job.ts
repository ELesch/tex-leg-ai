import { prisma } from '@/lib/db/prisma';
import { BillType, SyncJobStatus } from '@prisma/client';
import { getSettingTyped, getSetting } from '@/lib/admin/settings';

// Number of bills to process per batch (keep under Vercel timeout)
const BATCH_SIZE = 20;
const MAX_CONSECUTIVE_FAILURES = 10;

interface BillData {
  billId: string;
  billType: BillType;
  billNumber: number;
  description: string;
  content: string | null;
  authors: string[];
  status: string;
  lastAction: string;
  lastActionDate: Date | null;
}

export interface SyncJobState {
  id: string;
  status: SyncJobStatus;
  sessionCode: string;
  sessionName: string;
  billTypes: string[];
  progressByType: Record<string, number>;
  completedTypes: Record<string, boolean>;
  totalProcessed: number;
  totalCreated: number;
  totalUpdated: number;
  totalErrors: number;
  startedAt: Date | null;
  pausedAt: Date | null;
  completedAt: Date | null;
  lastActivityAt: Date;
  lastError: string | null;
}

export interface BatchResult {
  processed: number;
  created: number;
  updated: number;
  errors: number;
  billsProcessed: Array<{ billId: string; status: 'created' | 'updated' | 'skipped' | 'error' }>;
  isComplete: boolean;
  message: string;
}

/**
 * Get the current active sync job, if any
 */
export async function getActiveSyncJob(): Promise<SyncJobState | null> {
  const job = await prisma.syncJob.findFirst({
    where: {
      status: { in: ['PENDING', 'RUNNING', 'PAUSED'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!job) return null;

  return {
    id: job.id,
    status: job.status,
    sessionCode: job.sessionCode,
    sessionName: job.sessionName,
    billTypes: job.billTypes,
    progressByType: job.progressByType as Record<string, number>,
    completedTypes: job.completedTypes as Record<string, boolean>,
    totalProcessed: job.totalProcessed,
    totalCreated: job.totalCreated,
    totalUpdated: job.totalUpdated,
    totalErrors: job.totalErrors,
    startedAt: job.startedAt,
    pausedAt: job.pausedAt,
    completedAt: job.completedAt,
    lastActivityAt: job.lastActivityAt,
    lastError: job.lastError,
  };
}

/**
 * Get a sync job by ID
 */
export async function getSyncJob(jobId: string): Promise<SyncJobState | null> {
  const job = await prisma.syncJob.findUnique({
    where: { id: jobId },
  });

  if (!job) return null;

  return {
    id: job.id,
    status: job.status,
    sessionCode: job.sessionCode,
    sessionName: job.sessionName,
    billTypes: job.billTypes,
    progressByType: job.progressByType as Record<string, number>,
    completedTypes: job.completedTypes as Record<string, boolean>,
    totalProcessed: job.totalProcessed,
    totalCreated: job.totalCreated,
    totalUpdated: job.totalUpdated,
    totalErrors: job.totalErrors,
    startedAt: job.startedAt,
    pausedAt: job.pausedAt,
    completedAt: job.completedAt,
    lastActivityAt: job.lastActivityAt,
    lastError: job.lastError,
  };
}

/**
 * Create a new sync job
 */
export async function createSyncJob(): Promise<SyncJobState> {
  // Check if there's already an active job
  const existing = await getActiveSyncJob();
  if (existing) {
    throw new Error('A sync job is already active');
  }

  // Get settings
  const [sessionCode, sessionName] = await Promise.all([
    getSetting('SESSION_CODE'),
    getSetting('SESSION_NAME'),
  ]);

  const billTypes = ['HB', 'SB'];

  // Get current progress from database (highest bill number for each type)
  const progressByType: Record<string, number> = {};
  for (const billType of billTypes) {
    const lastBill = await prisma.bill.findFirst({
      where: { billType: billType as BillType },
      orderBy: { billNumber: 'desc' },
      select: { billNumber: true },
    });
    progressByType[billType] = lastBill?.billNumber || 0;
  }

  const job = await prisma.syncJob.create({
    data: {
      status: 'RUNNING',
      sessionCode: sessionCode || '89R',
      sessionName: sessionName || '89th Regular Session',
      billTypes,
      progressByType,
      completedTypes: {},
      startedAt: new Date(),
    },
  });

  return {
    id: job.id,
    status: job.status,
    sessionCode: job.sessionCode,
    sessionName: job.sessionName,
    billTypes: job.billTypes,
    progressByType: job.progressByType as Record<string, number>,
    completedTypes: job.completedTypes as Record<string, boolean>,
    totalProcessed: job.totalProcessed,
    totalCreated: job.totalCreated,
    totalUpdated: job.totalUpdated,
    totalErrors: job.totalErrors,
    startedAt: job.startedAt,
    pausedAt: job.pausedAt,
    completedAt: job.completedAt,
    lastActivityAt: job.lastActivityAt,
    lastError: job.lastError,
  };
}

/**
 * Pause a sync job
 */
export async function pauseSyncJob(jobId: string): Promise<SyncJobState> {
  const job = await prisma.syncJob.update({
    where: { id: jobId },
    data: {
      status: 'PAUSED',
      pausedAt: new Date(),
    },
  });

  return getSyncJob(job.id) as Promise<SyncJobState>;
}

/**
 * Resume a paused sync job
 */
export async function resumeSyncJob(jobId: string): Promise<SyncJobState> {
  const job = await prisma.syncJob.update({
    where: { id: jobId },
    data: {
      status: 'RUNNING',
      pausedAt: null,
    },
  });

  return getSyncJob(job.id) as Promise<SyncJobState>;
}

/**
 * Stop a sync job
 */
export async function stopSyncJob(jobId: string): Promise<SyncJobState> {
  const job = await prisma.syncJob.update({
    where: { id: jobId },
    data: {
      status: 'STOPPED',
      completedAt: new Date(),
    },
  });

  return getSyncJob(job.id) as Promise<SyncJobState>;
}

/**
 * Fetch bill text from Texas Legislature
 */
async function fetchBillText(
  sessionCode: string,
  billType: BillType,
  billNumber: number
): Promise<string | null> {
  const paddedNumber = billNumber.toString().padStart(5, '0');
  const billCode = `${billType}${paddedNumber}`;
  const versions = ['E', 'H', 'S', 'I'];

  for (const version of versions) {
    try {
      const url = `https://capitol.texas.gov/tlodocs/${sessionCode}/billtext/html/${billCode}${version}.htm`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'TxLegAI Bill Sync Bot (educational/research)' },
      });

      if (!response.ok) continue;

      const html = await response.text();
      if (html.includes('Website Error') || html.includes('Page Not Found')) continue;

      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        // Decode numeric HTML entities (&#xxx; and &#xXXX;)
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
        // Decode common named HTML entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/&rsquo;/g, "'")
        .replace(/&lsquo;/g, "'")
        .replace(/&rdquo;/g, '"')
        .replace(/&ldquo;/g, '"')
        .replace(/&sect;/g, '§')
        .replace(/&para;/g, '¶')
        .replace(/&copy;/g, '©')
        .replace(/&reg;/g, '®')
        .replace(/&deg;/g, '°')
        .replace(/&frac12;/g, '½')
        .replace(/&frac14;/g, '¼')
        .replace(/&frac34;/g, '¾')
        .replace(/&hellip;/g, '…')
        .replace(/&bull;/g, '•')
        .replace(/&middot;/g, '·')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n +/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (text.length > 100) {
        return text.substring(0, 50000);
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Fetch bill details from Texas Legislature
 */
async function fetchBillDetails(
  sessionCode: string,
  billType: BillType,
  billNumber: number
): Promise<BillData | null> {
  try {
    const url = `https://capitol.texas.gov/BillLookup/History.aspx?LegSess=${sessionCode}&Bill=${billType}${billNumber}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'TxLegAI Bill Sync Bot (educational/research)' },
    });

    if (!response.ok) return null;

    const html = await response.text();
    if (html.includes('Website Error') || html.includes('unexpected error')) return null;

    const captionMatch = html.match(/id="cellCaptionText"[^>]*>([^<]+)/i);
    const description = captionMatch ? captionMatch[1].trim() : `${billType} ${billNumber}`;

    const authorsMatch = html.match(/id="cellAuthors"[^>]*>([^<]+)/i);
    const authors = authorsMatch
      ? authorsMatch[1].split('|').map((a) => a.trim()).filter((a) => a.length > 0)
      : [];

    const actionMatches = html.match(
      /(?:Referred to|Read first time|Passed|Filed|Signed by|Sent to|Reported|Effective|Enrolled)[^<]*/gi
    );
    const lastAction = actionMatches?.[0]?.replace(/&nbsp;/g, ' ').trim() || '';

    let status = 'Filed';
    if (html.includes('Signed by the Governor') || html.includes('Effective on')) {
      status = 'Signed';
    } else if (html.includes('Sent to the Governor')) {
      status = 'Sent to Governor';
    } else if (html.includes('Enrolled')) {
      status = 'Enrolled';
    } else if (html.match(/Passed.*Senate/i) && html.match(/Passed.*House/i)) {
      status = 'Passed Both Chambers';
    } else if (html.includes('>Passed<') || html.includes('Passed to engrossment')) {
      status = 'Passed';
    } else if (html.includes('Referred to')) {
      status = 'In Committee';
    }

    const dateMatch = html.match(/(\d{2}\/\d{2}\/\d{4})/);
    const lastActionDate = dateMatch ? new Date(dateMatch[1]) : null;

    const content = await fetchBillText(sessionCode, billType, billNumber);

    return {
      billId: `${billType} ${billNumber}`,
      billType,
      billNumber,
      description: description.substring(0, 2000),
      content,
      authors,
      status,
      lastAction: lastAction.substring(0, 500),
      lastActionDate: isNaN(lastActionDate?.getTime() || NaN) ? null : lastActionDate,
    };
  } catch (error) {
    console.error(`Error fetching ${billType} ${billNumber}:`, error);
    return null;
  }
}

/**
 * Save a bill to the database
 */
async function saveBill(
  bill: BillData,
  sessionId: string
): Promise<'created' | 'updated' | 'error'> {
  try {
    const existing = await prisma.bill.findUnique({
      where: { billId: bill.billId },
      select: { id: true },
    });

    if (existing) {
      await prisma.bill.update({
        where: { billId: bill.billId },
        data: {
          description: bill.description,
          content: bill.content,
          authors: bill.authors,
          status: bill.status,
          lastAction: bill.lastAction,
          lastActionDate: bill.lastActionDate,
        },
      });
      return 'updated';
    } else {
      await prisma.bill.create({
        data: {
          sessionId,
          billType: bill.billType,
          billNumber: bill.billNumber,
          billId: bill.billId,
          filename: `${bill.billType.toLowerCase()}${bill.billNumber}.txt`,
          description: bill.description,
          content: bill.content,
          authors: bill.authors,
          subjects: [],
          status: bill.status,
          lastAction: bill.lastAction,
          lastActionDate: bill.lastActionDate,
        },
      });
      return 'created';
    }
  } catch (error) {
    console.error(`Error saving ${bill.billId}:`, error);
    return 'error';
  }
}

/**
 * Process a batch of bills for a sync job
 * Returns results of the batch and whether sync is complete
 */
export async function processSyncBatch(jobId: string): Promise<BatchResult> {
  const job = await prisma.syncJob.findUnique({ where: { id: jobId } });
  if (!job) {
    throw new Error('Sync job not found');
  }

  if (job.status !== 'RUNNING') {
    return {
      processed: 0,
      created: 0,
      updated: 0,
      errors: 0,
      billsProcessed: [],
      isComplete: job.status === 'COMPLETED',
      message: `Job is ${job.status.toLowerCase()}`,
    };
  }

  const batchDelay = (await getSettingTyped<number>('BATCH_DELAY_MS')) || 500;

  // Ensure session exists
  const session = await prisma.legislatureSession.upsert({
    where: { code: job.sessionCode },
    update: {},
    create: {
      code: job.sessionCode,
      name: job.sessionName,
      startDate: new Date('2025-01-14'),
      isActive: true,
    },
  });

  const progressByType = job.progressByType as Record<string, number>;
  const completedTypes = job.completedTypes as Record<string, boolean>;
  const billsProcessed: Array<{ billId: string; status: 'created' | 'updated' | 'skipped' | 'error' }> = [];

  let processed = 0;
  let created = 0;
  let updated = 0;
  let errors = 0;

  // Find the first non-completed bill type
  let currentBillType: string | null = null;
  for (const billType of job.billTypes) {
    if (!completedTypes[billType]) {
      currentBillType = billType;
      break;
    }
  }

  if (!currentBillType) {
    // All types completed
    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        lastActivityAt: new Date(),
      },
    });

    return {
      processed: 0,
      created: 0,
      updated: 0,
      errors: 0,
      billsProcessed: [],
      isComplete: true,
      message: 'All bill types have been fully synced',
    };
  }

  let consecutiveFailures = 0;
  let billNumber = (progressByType[currentBillType] || 0) + 1;

  // Process a batch
  while (processed < BATCH_SIZE && consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
    // Check if job was paused/stopped
    const currentJob = await prisma.syncJob.findUnique({
      where: { id: jobId },
      select: { status: true },
    });
    if (currentJob?.status !== 'RUNNING') {
      break;
    }

    const billData = await fetchBillDetails(job.sessionCode, currentBillType as BillType, billNumber);

    if (billData) {
      const saveResult = await saveBill(billData, session.id);
      billsProcessed.push({ billId: billData.billId, status: saveResult });

      if (saveResult === 'created') created++;
      else if (saveResult === 'updated') updated++;
      else errors++;

      consecutiveFailures = 0;
    } else {
      consecutiveFailures++;
    }

    processed++;
    progressByType[currentBillType] = billNumber;
    billNumber++;

    // Rate limiting
    if (processed % 5 === 0) {
      await new Promise((resolve) => setTimeout(resolve, batchDelay));
    }
  }

  // Check if this bill type is exhausted
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    completedTypes[currentBillType] = true;
  }

  // Check if all types are now completed
  const allCompleted = job.billTypes.every((type) => completedTypes[type]);

  // Re-check current job status to avoid overwriting PAUSED/STOPPED
  const currentJobStatus = await prisma.syncJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  });

  // Only update status if job is still RUNNING (don't overwrite PAUSED/STOPPED)
  const shouldUpdateStatus = currentJobStatus?.status === 'RUNNING';
  const newStatus = allCompleted ? 'COMPLETED' : (shouldUpdateStatus ? 'RUNNING' : undefined);

  // Update job state
  await prisma.syncJob.update({
    where: { id: jobId },
    data: {
      progressByType,
      completedTypes,
      totalProcessed: job.totalProcessed + processed,
      totalCreated: job.totalCreated + created,
      totalUpdated: job.totalUpdated + updated,
      totalErrors: job.totalErrors + errors,
      lastActivityAt: new Date(),
      ...(newStatus && { status: newStatus }),
      ...(allCompleted && { completedAt: new Date() }),
    },
  });

  return {
    processed,
    created,
    updated,
    errors,
    billsProcessed,
    isComplete: allCompleted,
    message: allCompleted
      ? 'All bill types have been fully synced'
      : `Processed ${processed} bills (${currentBillType})`,
  };
}
