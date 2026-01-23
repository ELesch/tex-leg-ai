import { prisma } from '@/lib/db/prisma';
import { BillType } from '@prisma/client';
import { getSettingTyped, getSetting } from '@/lib/admin/settings';

// Event types for progress reporting
export type SyncEventType = 'phase' | 'progress' | 'bill' | 'complete' | 'error' | 'log';

export type SyncPhase =
  | 'initializing'
  | 'fetching_list'
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
  status: string;
  lastAction: string;
  lastActionDate: Date | null;
}

type EventCallback = (type: SyncEventType, data: unknown) => void;

/**
 * Fetch bill text from Texas Legislature
 * Returns the most recent version of the bill text (Engrossed > Committee Report > Introduced)
 */
async function fetchBillText(
  sessionCode: string,
  billType: BillType,
  billNumber: number
): Promise<string | null> {
  // Format bill number with leading zeros (HB 13 -> HB00013)
  const paddedNumber = billNumber.toString().padStart(5, '0');
  const billCode = `${billType}${paddedNumber}`;

  // Try versions in order of preference: Engrossed, House/Senate Committee Report, Introduced
  const versions = ['E', 'H', 'S', 'I'];

  for (const version of versions) {
    try {
      const url = `https://capitol.texas.gov/tlodocs/${sessionCode}/billtext/html/${billCode}${version}.htm`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'TxLegAI Bill Sync Bot (educational/research)',
        },
      });

      if (!response.ok) {
        continue; // Try next version
      }

      const html = await response.text();

      // Check if it's an error page
      if (html.includes('Website Error') || html.includes('Page Not Found')) {
        continue;
      }

      // Extract text content from HTML - remove tags but preserve structure
      let text = html
        // Remove script and style tags and their content
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        // Convert <br> and block elements to newlines
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
        // Remove remaining HTML tags
        .replace(/<[^>]+>/g, '')
        // Decode HTML entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&#xA0;/gi, ' ')  // Non-breaking space (hex)
        .replace(/&#160;/g, ' ')   // Non-breaking space (decimal)
        .replace(/&amp;/g, '&')
        .replace(/&#38;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&#60;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#62;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&mdash;/g, '—')
        .replace(/&#8212;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/&#8211;/g, '–')
        .replace(/&hellip;/g, '...')
        .replace(/&#8230;/g, '...')
        .replace(/&ldquo;/g, '"')
        .replace(/&#8220;/g, '"')
        .replace(/&rdquo;/g, '"')
        .replace(/&#8221;/g, '"')
        .replace(/&lsquo;/g, "'")
        .replace(/&#8216;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&#8217;/g, "'")
        .replace(/&sect;/g, '§')
        .replace(/&#167;/g, '§')
        .replace(/&para;/g, '¶')
        .replace(/&#182;/g, '¶')
        .replace(/&deg;/g, '°')
        .replace(/&#176;/g, '°')
        .replace(/&cent;/g, '¢')
        .replace(/&#162;/g, '¢')
        .replace(/&copy;/g, '©')
        .replace(/&#169;/g, '©')
        // Clean up whitespace
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n +/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (text.length > 100) {
        return text.substring(0, 50000); // Limit to 50KB
      }
    } catch {
      continue; // Try next version
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
      headers: {
        'User-Agent': 'TxLegAI Bill Sync Bot (educational/research)',
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Check if this is an error page (bill doesn't exist)
    if (html.includes('Website Error') || html.includes('unexpected error')) {
      return null;
    }

    // Extract caption from <td id="cellCaptionText">...</td>
    const captionMatch = html.match(/id="cellCaptionText"[^>]*>([^<]+)/i);
    const description = captionMatch
      ? captionMatch[1].trim()
      : `${billType} ${billNumber}`;

    // Extract authors from <td id="cellAuthors">Name | Name | Name</td>
    const authorsMatch = html.match(/id="cellAuthors"[^>]*>([^<]+)/i);
    const authors = authorsMatch
      ? authorsMatch[1]
          .split('|')
          .map((a) => a.trim())
          .filter((a) => a.length > 0)
      : [];

    // Extract action descriptions to find the most recent action
    const actionMatches = html.match(
      /(?:Referred to|Read first time|Passed|Filed|Signed by|Sent to|Reported|Effective|Enrolled)[^<]*/gi
    );
    const lastAction = actionMatches && actionMatches.length > 0
      ? actionMatches[0].replace(/&nbsp;/g, ' ').trim()
      : '';

    // Determine status based on page content
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
    } else if (html.includes('Read first time')) {
      status = 'Filed';
    }

    // Try to extract the most recent date
    const dateMatch = html.match(/(\d{2}\/\d{2}\/\d{4})/);
    const lastActionDate = dateMatch ? new Date(dateMatch[1]) : null;

    // Fetch the bill text content
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
          status: bill.status,
          lastAction: bill.lastAction,
          lastActionDate: bill.lastActionDate,
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
 * Fetch and process bills from Texas Legislature
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
  const maxPerType = syncUntilComplete ? Infinity : Math.floor(maxBills / billTypes.length);
  const maxConsecutiveFailures = 10; // Stop after N consecutive 404s

  let totalProcessed = 0;
  let totalFetched = 0;
  let created = 0;
  let updated = 0;
  let errors = 0;

  onEvent('log', {
    message: `Starting sync: session=${sessionCode}, ${syncUntilComplete ? 'sync until complete' : `maxBills=${maxBills}`}, types=${billTypes.join(',')}`,
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

  const billTypeStatus = new Map<BillType, { exhausted: boolean; lastBillNumber: number }>();

  for (const billType of billTypes) {
    // Check for abort
    if (abortSignal?.aborted) {
      onEvent('log', {
        message: 'Sync stopped by user',
        level: 'warn',
      } as SyncLogEvent);
      break;
    }

    const startNumber = (lastSyncedNumbers.get(billType) || 0) + 1;

    onEvent('phase', {
      phase: 'processing_bills',
      message: `Processing ${billType} bills starting from ${billType} ${startNumber}...`,
    } as SyncPhaseEvent);

    let consecutiveFailures = 0;
    let billsProcessedForType = 0;
    let billNumber = startNumber;
    let typeExhausted = false;

    while (billsProcessedForType < maxPerType && consecutiveFailures < maxConsecutiveFailures) {
      // Check for abort
      if (abortSignal?.aborted) {
        onEvent('log', {
          message: 'Sync stopped by user',
          level: 'warn',
        } as SyncLogEvent);
        break;
      }

      totalProcessed++;

      // Update progress
      if (syncUntilComplete) {
        onEvent('progress', {
          current: totalFetched,
          total: totalProcessed,
          percent: consecutiveFailures > 0
            ? Math.round(((maxConsecutiveFailures - consecutiveFailures) / maxConsecutiveFailures) * 100)
            : 100,
          billType,
        } as SyncProgressEvent);
      } else {
        onEvent('progress', {
          current: totalProcessed,
          total: maxBills,
          percent: Math.min(Math.round((totalProcessed / maxBills) * 100), 99),
          billType,
        } as SyncProgressEvent);
      }

      // Fetch bill data from legislature
      const billData = await fetchBillDetails(sessionCode, billType, billNumber);

      if (billData) {
        totalFetched++;
        billsProcessedForType++;
        consecutiveFailures = 0;

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
        consecutiveFailures++;
      }

      billNumber++;

      // Rate limiting - delay every 5 requests
      if (totalProcessed % 5 === 0) {
        await new Promise((resolve) => setTimeout(resolve, batchDelay));
      }
    }

    if (consecutiveFailures >= maxConsecutiveFailures) {
      typeExhausted = true;
      onEvent('log', {
        message: `${billType} complete: reached end of filed bills after ${billsProcessedForType} bills`,
        level: 'info',
      } as SyncLogEvent);
    }

    billTypeStatus.set(billType, {
      exhausted: typeExhausted,
      lastBillNumber: billNumber - 1,
    });

    onEvent('log', {
      message: `Finished ${billType}: processed ${billsProcessedForType} bills (checked ${billType} ${startNumber} to ${billNumber - 1})${typeExhausted ? ' - EXHAUSTED' : ''}`,
      level: 'info',
    } as SyncLogEvent);
  }

  // Report final status
  if (syncUntilComplete) {
    const allExhausted = Array.from(billTypeStatus.values()).every(s => s.exhausted);
    onEvent('log', {
      message: allExhausted
        ? 'All bill types have been fully synced'
        : `Sync stopped - some bill types may have more bills`,
      level: allExhausted ? 'info' : 'warn',
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

    console.log('Sync settings:', {
      sessionCode,
      sessionName,
      maxBills,
      batchDelay,
      billTypes,
      syncEnabled,
      syncUntilComplete,
      fromOptions: {
        sessionCode: options.sessionCode,
        maxBills: options.maxBills,
        billTypes: options.billTypes,
        syncUntilComplete: options.syncUntilComplete,
      },
      fromDefaults: {
        sessionCode: defaultSessionCode,
        maxBills: defaultMaxBills,
      },
    });

    onEvent('phase', {
      phase: 'initializing',
      message: `Initializing ${syncUntilComplete ? 'full' : 'partial'} sync for ${sessionName}...`,
    } as SyncPhaseEvent);

    console.log('Starting streaming bill sync...');

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

    console.log('Sync complete:', {
      ...result,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error('Sync failed:', error);
    onEvent('error', {
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined,
    } as SyncErrorEvent);
  }
}
