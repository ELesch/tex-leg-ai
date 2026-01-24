import { prisma } from '@/lib/db/prisma';
import { BillType, SyncJobStatus } from '@prisma/client';
import { getSettingTyped, getSetting } from '@/lib/admin/settings';
import { fetchBillXml, fetchBillTextFromUrl, scanAvailableBills, closeSharedClient } from './ftp-client';
import { parseBillXml, ParsedBill } from './xml-parser';
import { logger } from '@/lib/logger';

// Number of bills to process per batch (keep under Vercel timeout)
const BATCH_SIZE = 20;

interface BillData {
  billId: string;
  billType: BillType;
  billNumber: number;
  description: string;
  content: string | null;
  authors: string[];
  coauthors: string[];
  sponsors: string[];
  cosponsors: string[];
  subjects: string[];
  status: string;
  lastAction: string;
  lastActionDate: Date | null;
  lastUpdateFtp: Date | null;
  committeeName: string | null;
  committeeStatus: string | null;
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

// Cache for available bills per type (populated on first scan)
const availableBillsCache = new Map<string, number[]>();

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
 * Convert parsed XML bill to BillData format
 */
async function convertParsedBillToBillData(
  parsed: ParsedBill
): Promise<BillData> {
  // Fetch bill text if URL is available
  let content: string | null = null;
  if (parsed.textUrl) {
    content = await fetchBillTextFromUrl(parsed.textUrl);
  }

  // Get the most relevant committee info
  let committeeName: string | null = null;
  let committeeStatus: string | null = null;
  if (parsed.committees.length > 0) {
    // Prefer committee that's "In committee" or most recent
    const inCommittee = parsed.committees.find(c => c.status.toLowerCase().includes('in committee'));
    const committee = inCommittee || parsed.committees[0];
    committeeName = committee.name;
    committeeStatus = committee.status;
  }

  return {
    billId: parsed.billId,
    billType: parsed.billType,
    billNumber: parsed.billNumber,
    description: parsed.description,
    content,
    authors: parsed.authors,
    coauthors: parsed.coauthors,
    sponsors: parsed.sponsors,
    cosponsors: parsed.cosponsors,
    subjects: parsed.subjects,
    status: parsed.status,
    lastAction: parsed.lastAction,
    lastActionDate: parsed.lastActionDate,
    lastUpdateFtp: parsed.lastUpdate,
    committeeName,
    committeeStatus,
  };
}

interface FetchBillFromFtpResult {
  data: BillData | null;
  notFound: boolean;  // true if bill doesn't exist (not an error)
  error: boolean;     // true if there was an actual error
}

/**
 * Fetch bill data from FTP server (XML-based)
 */
async function fetchBillFromFtp(
  sessionCode: string,
  billType: BillType,
  billNumber: number
): Promise<FetchBillFromFtpResult> {
  try {
    // Fetch XML from FTP
    const result = await fetchBillXml(sessionCode, billType, billNumber);

    if (result.notFound) {
      return { data: null, notFound: true, error: false };
    }

    if (result.error || !result.xml) {
      return { data: null, notFound: false, error: true };
    }

    // Parse XML
    const parsed = parseBillXml(result.xml);
    if (!parsed) {
      logger.error('Failed to parse XML', { billType, billNumber });
      return { data: null, notFound: false, error: true };
    }

    // Convert to BillData format and fetch bill text
    const data = await convertParsedBillToBillData(parsed);
    return { data, notFound: false, error: false };
  } catch (error) {
    logger.error('Error fetching bill from FTP', {
      billType,
      billNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return { data: null, notFound: false, error: true };
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
          coauthors: bill.coauthors,
          sponsors: bill.sponsors,
          cosponsors: bill.cosponsors,
          subjects: bill.subjects,
          status: bill.status,
          lastAction: bill.lastAction,
          lastActionDate: bill.lastActionDate,
          lastUpdateFtp: bill.lastUpdateFtp,
          committeeName: bill.committeeName,
          committeeStatus: bill.committeeStatus,
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
          coauthors: bill.coauthors,
          sponsors: bill.sponsors,
          cosponsors: bill.cosponsors,
          subjects: bill.subjects,
          status: bill.status,
          lastAction: bill.lastAction,
          lastActionDate: bill.lastActionDate,
          lastUpdateFtp: bill.lastUpdateFtp,
          committeeName: bill.committeeName,
          committeeStatus: bill.committeeStatus,
        },
      });
      return 'created';
    }
  } catch (error) {
    logger.error('Error saving bill', {
      billId: bill.billId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 'error';
  }
}

/**
 * Get or scan available bills for a bill type
 */
async function getAvailableBills(
  sessionCode: string,
  billType: string
): Promise<number[]> {
  const cacheKey = `${sessionCode}-${billType}`;

  if (!availableBillsCache.has(cacheKey)) {
    logger.info('Scanning available bills from FTP', { billType });
    const bills = await scanAvailableBills(sessionCode, billType);
    availableBillsCache.set(cacheKey, bills);
    logger.info('Found bills on FTP', { billType, count: bills.length });
  }

  return availableBillsCache.get(cacheKey) || [];
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

  // Get available bills for this type from FTP
  const availableBills = await getAvailableBills(job.sessionCode, currentBillType);

  // Find bills that still need to be processed
  const lastProcessed = progressByType[currentBillType] || 0;
  const billsToProcess = availableBills.filter(num => num > lastProcessed);

  if (billsToProcess.length === 0) {
    // No more bills of this type
    completedTypes[currentBillType] = true;

    // Check if all types are now completed
    const allCompleted = job.billTypes.every((type) => completedTypes[type]);

    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        completedTypes,
        lastActivityAt: new Date(),
        ...(allCompleted && { status: 'COMPLETED', completedAt: new Date() }),
      },
    });

    return {
      processed: 0,
      created: 0,
      updated: 0,
      errors: 0,
      billsProcessed: [],
      isComplete: allCompleted,
      message: allCompleted
        ? 'All bill types have been fully synced'
        : `Completed ${currentBillType}, moving to next type`,
    };
  }

  // Process a batch of bills
  const batchBills = billsToProcess.slice(0, BATCH_SIZE);

  for (const billNumber of batchBills) {
    // Check if job was paused/stopped
    const currentJob = await prisma.syncJob.findUnique({
      where: { id: jobId },
      select: { status: true },
    });
    if (currentJob?.status !== 'RUNNING') {
      break;
    }

    const fetchResult = await fetchBillFromFtp(job.sessionCode, currentBillType as BillType, billNumber);

    if (fetchResult.notFound) {
      // Bill doesn't exist - skip silently, not an error
      billsProcessed.push({ billId: `${currentBillType} ${billNumber}`, status: 'skipped' });
    } else if (fetchResult.error || !fetchResult.data) {
      // Actual error
      errors++;
      billsProcessed.push({ billId: `${currentBillType} ${billNumber}`, status: 'error' });
    } else {
      // Success - save to database
      const billData = fetchResult.data;
      const saveResult = await saveBill(billData, session.id);
      billsProcessed.push({ billId: billData.billId, status: saveResult });

      if (saveResult === 'created') created++;
      else if (saveResult === 'updated') updated++;
      else errors++;
    }

    processed++;
    progressByType[currentBillType] = billNumber;

    // Rate limiting
    if (processed % 5 === 0) {
      await new Promise((resolve) => setTimeout(resolve, batchDelay));
    }
  }

  // Check if this bill type is now exhausted
  const remainingBills = availableBills.filter(num => num > progressByType[currentBillType]);
  if (remainingBills.length === 0) {
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
