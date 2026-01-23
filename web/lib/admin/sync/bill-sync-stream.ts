import { prisma } from '@/lib/db/prisma';
import { BillType } from '@prisma/client';
import { getSettingTyped, getSetting } from '@/lib/admin/settings';
import { fetchBillXml, fetchBillTextFromUrl, scanAvailableBills } from './ftp-client';
import { parseBillXml, ParsedBill } from './xml-parser';
import { logger } from '@/lib/logger';

// Event types for progress reporting
export type SyncEventType = 'phase' | 'progress' | 'bill' | 'complete' | 'error' | 'log';

export type SyncPhase =
  | 'initializing'
  | 'scanning_ftp'
  | 'processing_bills'
  | 'saving'
  | 'complete';

export interface SyncPhaseEvent {
  phase: SyncPhase;
  message: string;
}

export interface SyncProgressEvent {
  current: number;
  total: number;
  percent: number;
  billType: string;
}

export interface SyncBillEvent {
  billId: string;
  status: 'created' | 'updated' | 'skipped' | 'error';
  message?: string;
}

export interface SyncCompleteEvent {
  success: boolean;
  duration: number;
  summary: {
    fetched: number;
    created: number;
    updated: number;
    errors: number;
  };
}

export interface SyncErrorEvent {
  message: string;
  details?: string;
}

export interface SyncLogEvent {
  message: string;
  level: 'info' | 'warn' | 'error';
}

export type SyncEvent =
  | { type: 'phase'; data: SyncPhaseEvent }
  | { type: 'progress'; data: SyncProgressEvent }
  | { type: 'bill'; data: SyncBillEvent }
  | { type: 'complete'; data: SyncCompleteEvent }
  | { type: 'error'; data: SyncErrorEvent }
  | { type: 'log'; data: SyncLogEvent };

export interface SyncOptions {
  maxBills?: number;
  billTypes?: BillType[];
  sessionCode?: string;
  sessionName?: string;
  batchDelay?: number;
  syncUntilComplete?: boolean; // Continue until all bill types are exhausted
  abortSignal?: { aborted: boolean }; // Signal to check for abort/pause
}

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

type EventCallback = (type: SyncEventType, data: unknown) => void;

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

/**
 * Fetch bill data from FTP server (XML-based)
 */
async function fetchBillFromFtp(
  sessionCode: string,
  billType: BillType,
  billNumber: number
): Promise<BillData | null> {
  try {
    // Fetch XML from FTP
    const xml = await fetchBillXml(sessionCode, billType, billNumber);
    if (!xml) {
      return null; // Bill doesn't exist
    }

    // Parse XML
    const parsed = parseBillXml(xml);
    if (!parsed) {
      logger.error('Failed to parse XML', { billType, billNumber });
      return null;
    }

    // Convert to BillData format and fetch bill text
    return await convertParsedBillToBillData(parsed);
  } catch (error) {
    logger.error('Error fetching bill from FTP', {
      billType,
      billNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Get the highest bill number already in the database for each type
 */
async function getLastSyncedBillNumbers(
  billTypes: BillType[]
): Promise<Map<BillType, number>> {
  const result = new Map<BillType, number>();

  for (const billType of billTypes) {
    const lastBill = await prisma.bill.findFirst({
      where: { billType },
      orderBy: { billNumber: 'desc' },
      select: { billNumber: true },
    });
    result.set(billType, lastBill?.billNumber || 0);
  }

  return result;
}

/**
 * Save a single bill to the database
 * Returns 'created', 'updated', or 'error'
 */
async function saveBillToDatabase(
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
          sessionId: sessionId,
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
 * Fetch and process bills from Texas Legislature FTP server
 * Each bill is saved immediately after fetching - no data is lost if sync is stopped
 */
async function fetchAndProcessBills(
  sessionCode: string,
  sessionName: string,
  maxBills: number,
  batchDelay: number,
  billTypes: BillType[],
  onEvent: EventCallback,
  syncUntilComplete: boolean = false,
  abortSignal?: { aborted: boolean }
): Promise<{ fetched: number; created: number; updated: number; errors: number }> {
  let totalProcessed = 0;
  let totalFetched = 0;
  let created = 0;
  let updated = 0;
  let errors = 0;

  onEvent('log', {
    message: `Starting FTP-based sync: session=${sessionCode}, ${syncUntilComplete ? 'sync until complete' : `maxBills=${maxBills}`}, types=${billTypes.join(',')}`,
    level: 'info',
  } as SyncLogEvent);

  // Ensure the session exists
  const session = await prisma.legislatureSession.upsert({
    where: { code: sessionCode },
    update: {},
    create: {
      code: sessionCode,
      name: sessionName,
      startDate: new Date('2025-01-14'),
      isActive: true,
    },
  });

  // Get the highest bill number already in the database for each type
  const lastSyncedNumbers = await getLastSyncedBillNumbers(billTypes);

  billTypes.forEach((type) => {
    const lastNum = lastSyncedNumbers.get(type) || 0;
    onEvent('log', {
      message: `Last synced ${type}: ${lastNum > 0 ? type + ' ' + lastNum : 'none'}`,
      level: 'info',
    } as SyncLogEvent);
  });

  // Scan FTP to get available bills for each type
  onEvent('phase', {
    phase: 'scanning_ftp',
    message: 'Scanning FTP server for available bills...',
  } as SyncPhaseEvent);

  const availableBillsByType = new Map<BillType, number[]>();
  let totalAvailable = 0;

  for (const billType of billTypes) {
    // Check for abort
    if (abortSignal?.aborted) {
      break;
    }

    onEvent('log', {
      message: `Scanning available ${billType} bills from FTP...`,
      level: 'info',
    } as SyncLogEvent);

    const availableBills = await scanAvailableBills(sessionCode, billType);
    const lastSynced = lastSyncedNumbers.get(billType) || 0;
    const billsToSync = availableBills.filter(num => num > lastSynced);

    availableBillsByType.set(billType, billsToSync);
    totalAvailable += billsToSync.length;

    onEvent('log', {
      message: `Found ${availableBills.length} ${billType} bills total, ${billsToSync.length} to sync`,
      level: 'info',
    } as SyncLogEvent);
  }

  // Apply maxBills limit if not syncing until complete
  const maxPerType = syncUntilComplete ? Infinity : Math.floor(maxBills / billTypes.length);
  const totalToProcess = syncUntilComplete ? totalAvailable : Math.min(maxBills, totalAvailable);

  onEvent('log', {
    message: `Total bills to sync: ${totalToProcess}`,
    level: 'info',
  } as SyncLogEvent);

  // Process bills for each type
  for (const billType of billTypes) {
    // Check for abort
    if (abortSignal?.aborted) {
      onEvent('log', {
        message: 'Sync stopped by user',
        level: 'warn',
      } as SyncLogEvent);
      break;
    }

    const billsToProcess = availableBillsByType.get(billType) || [];
    if (billsToProcess.length === 0) {
      onEvent('log', {
        message: `No new ${billType} bills to sync`,
        level: 'info',
      } as SyncLogEvent);
      continue;
    }

    // Limit bills if not syncing until complete
    const limitedBills = syncUntilComplete ? billsToProcess : billsToProcess.slice(0, maxPerType);

    onEvent('phase', {
      phase: 'processing_bills',
      message: `Processing ${limitedBills.length} ${billType} bills...`,
    } as SyncPhaseEvent);

    let billsProcessedForType = 0;

    for (const billNumber of limitedBills) {
      // Check for abort
      if (abortSignal?.aborted) {
        onEvent('log', {
          message: 'Sync stopped by user',
          level: 'warn',
        } as SyncLogEvent);
        break;
      }

      totalProcessed++;
      billsProcessedForType++;

      // Update progress with accurate count
      onEvent('progress', {
        current: totalProcessed,
        total: totalToProcess,
        percent: Math.min(Math.round((totalProcessed / totalToProcess) * 100), 99),
        billType,
      } as SyncProgressEvent);

      // Fetch bill data from FTP
      const billData = await fetchBillFromFtp(sessionCode, billType, billNumber);

      if (billData) {
        totalFetched++;

        // Immediately save to database
        const saveResult = await saveBillToDatabase(billData, session.id);

        if (saveResult === 'created') {
          created++;
          onEvent('bill', {
            billId: billData.billId,
            status: 'created',
          } as SyncBillEvent);
        } else if (saveResult === 'updated') {
          updated++;
          onEvent('bill', {
            billId: billData.billId,
            status: 'updated',
          } as SyncBillEvent);
        } else {
          errors++;
          onEvent('bill', {
            billId: billData.billId,
            status: 'error',
            message: 'Failed to save to database',
          } as SyncBillEvent);
        }

        if (billsProcessedForType % 10 === 0) {
          onEvent('log', {
            message: `Processed ${billsProcessedForType} ${billType} bills (${created} created, ${updated} updated)`,
            level: 'info',
          } as SyncLogEvent);
        }
      } else {
        errors++;
        onEvent('bill', {
          billId: `${billType} ${billNumber}`,
          status: 'error',
          message: 'Failed to fetch from FTP',
        } as SyncBillEvent);
      }

      // Rate limiting - delay every 5 requests
      if (totalProcessed % 5 === 0) {
        await new Promise((resolve) => setTimeout(resolve, batchDelay));
      }
    }

    onEvent('log', {
      message: `Finished ${billType}: processed ${billsProcessedForType} bills`,
      level: 'info',
    } as SyncLogEvent);
  }

  return { fetched: totalFetched, created, updated, errors };
}

/**
 * Main sync function with progress callbacks
 */
export async function syncBillsWithProgress(
  options: SyncOptions,
  onEvent: EventCallback
): Promise<void> {
  const startTime = Date.now();

  try {
    // Get settings from database
    const [defaultSessionCode, defaultSessionName, defaultMaxBills, defaultBatchDelay, syncEnabled] =
      await Promise.all([
        getSetting('SESSION_CODE'),
        getSetting('SESSION_NAME'),
        getSettingTyped<number>('MAX_BILLS_PER_SYNC'),
        getSettingTyped<number>('BATCH_DELAY_MS'),
        getSettingTyped<boolean>('SYNC_ENABLED'),
      ]);

    if (syncEnabled === false) {
      onEvent('error', {
        message: 'Sync is disabled',
        details: 'Enable sync in settings first.',
      } as SyncErrorEvent);
      return;
    }

    const sessionCode = options.sessionCode || defaultSessionCode || '89R';
    const sessionName = options.sessionName || defaultSessionName || '89th Regular Session';
    const maxBills = options.maxBills || defaultMaxBills || 100;
    const batchDelay = options.batchDelay || defaultBatchDelay || 500;
    const billTypes = options.billTypes || ['HB', 'SB'];
    const syncUntilComplete = options.syncUntilComplete ?? true; // Default to sync until complete

    logger.info('Sync settings', {
      sessionCode,
      sessionName,
      maxBills,
      batchDelay,
      billTypes,
      syncEnabled,
      syncUntilComplete,
    });

    onEvent('phase', {
      phase: 'initializing',
      message: `Initializing ${syncUntilComplete ? 'full' : 'partial'} FTP sync for ${sessionName}...`,
    } as SyncPhaseEvent);

    logger.info('Starting FTP-based streaming bill sync');

    // Fetch and process bills immediately (each bill saved right after fetching)
    const result = await fetchAndProcessBills(
      sessionCode,
      sessionName,
      maxBills,
      batchDelay,
      billTypes as BillType[],
      onEvent,
      syncUntilComplete,
      options.abortSignal
    );

    const duration = Date.now() - startTime;

    onEvent('phase', {
      phase: 'complete',
      message: 'Sync complete!',
    } as SyncPhaseEvent);

    onEvent('complete', {
      success: true,
      duration,
      summary: {
        fetched: result.fetched,
        created: result.created,
        updated: result.updated,
        errors: result.errors,
      },
    } as SyncCompleteEvent);

    logger.info('Sync complete', {
      ...result,
      duration,
    });
  } catch (error) {
    logger.error('Sync failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    onEvent('error', {
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined,
    } as SyncErrorEvent);
  }
}
