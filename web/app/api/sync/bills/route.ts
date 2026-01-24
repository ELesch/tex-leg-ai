import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { BillType } from '@prisma/client';
import { getSetting, getSettingTyped } from '@/lib/admin/settings';

// Protect the endpoint with a secret key
const SYNC_SECRET = process.env.CRON_SECRET || process.env.SYNC_SECRET;

interface BillData {
  billId: string;
  billType: BillType;
  billNumber: number;
  description: string;
  authors: string[];
  status: string;
  lastAction: string;
  lastActionDate: Date | null;
}

/**
 * Fetch bill data from Texas Legislature
 * Uses their public web pages to get bill information
 */
async function fetchBillsFromLegislature(
  sessionCode: string,
  maxBills: number,
  batchDelay: number
): Promise<BillData[]> {
  const bills: BillData[] = [];
  const billTypes: BillType[] = ['HB', 'SB'];

  for (const billType of billTypes) {
    try {
      // Fetch bill listing page
      // Texas Legislature provides bill lists at capitol.texas.gov
      const listUrl = `https://capitol.texas.gov/Reports/Report.aspx?LegSess=${sessionCode}&ID=${billType}ALLBYNUM`;

      const response = await fetch(listUrl, {
        headers: {
          'User-Agent': 'TexLegAI Bill Sync Bot (educational/research)',
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch ${billType} list: ${response.status}`);
        continue;
      }

      const html = await response.text();

      // Parse bill numbers from the listing page
      // The page contains links like "HB 1", "HB 2", etc.
      const billPattern = new RegExp(`(${billType})\\s*(\\d+)`, 'gi');
      const matches = Array.from(html.matchAll(billPattern));
      const billNumbers = new Set<number>();

      for (const match of matches) {
        const num = parseInt(match[2]);
        if (num > 0 && num < 10000) {
          billNumbers.add(num);
        }
      }

      console.log(`Found ${billNumbers.size} ${billType} bills`);

      // Fetch details for each bill (in batches to avoid rate limiting)
      const numbers = Array.from(billNumbers).sort((a, b) => a - b);
      const maxPerType = Math.floor(maxBills / billTypes.length);

      for (let i = 0; i < Math.min(numbers.length, maxPerType); i++) {
        const billNum = numbers[i];
        const billData = await fetchBillDetails(sessionCode, billType, billNum);
        if (billData) {
          bills.push(billData);
        }

        // Small delay to be respectful of their servers
        if (i % 10 === 9) {
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      }
    } catch (error) {
      console.error(`Error fetching ${billType} bills:`, error);
    }
  }

  return bills;
}

/**
 * Fetch details for a specific bill
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
        'User-Agent': 'TexLegAI Bill Sync Bot (educational/research)',
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Extract bill caption/description
    const captionMatch = html.match(/Caption[^>]*>([^<]+)/i) ||
                         html.match(/<span[^>]*id="[^"]*Caption[^"]*"[^>]*>([^<]+)/i);
    const description = captionMatch ? captionMatch[1].trim() : `${billType} ${billNumber}`;

    // Extract authors
    const authorMatch = html.match(/Author[^>]*>([^<]+)/i);
    const authors = authorMatch ? [authorMatch[1].trim()] : [];

    // Extract last action
    const actionMatch = html.match(/Action[^>]*>([^<]+)/i);
    const lastAction = actionMatch ? actionMatch[1].trim() : '';

    // Extract status (simplified)
    let status = 'Filed';
    if (html.includes('Signed by the Governor')) {
      status = 'Signed';
    } else if (html.includes('Sent to the Governor')) {
      status = 'Sent to Governor';
    } else if (html.includes('passed')) {
      status = 'Passed';
    } else if (html.includes('committee')) {
      status = 'In Committee';
    }

    return {
      billId: `${billType} ${billNumber}`,
      billType,
      billNumber,
      description: description.substring(0, 2000), // Limit length
      authors,
      status,
      lastAction: lastAction.substring(0, 500),
      lastActionDate: null,
    };
  } catch (error) {
    console.error(`Error fetching ${billType} ${billNumber}:`, error);
    return null;
  }
}

/**
 * Sync bills to database
 */
async function syncBillsToDatabase(
  bills: BillData[],
  sessionCode: string,
  sessionName: string
): Promise<{ created: number; updated: number; errors: number }> {
  let created = 0;
  let updated = 0;
  let errors = 0;

  // Ensure session exists
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

  for (const bill of bills) {
    try {
      const existing = await prisma.bill.findUnique({
        where: { billId: bill.billId },
        select: { id: true },
      });

      if (existing) {
        // Update existing bill
        await prisma.bill.update({
          where: { billId: bill.billId },
          data: {
            description: bill.description,
            authors: bill.authors,
            status: bill.status,
            lastAction: bill.lastAction,
            lastActionDate: bill.lastActionDate,
          },
        });
        updated++;
      } else {
        // Create new bill
        await prisma.bill.create({
          data: {
            sessionId: session.id,
            billType: bill.billType,
            billNumber: bill.billNumber,
            billId: bill.billId,
            filename: `${bill.billType.toLowerCase()}${bill.billNumber}.txt`,
            description: bill.description,
            authors: bill.authors,
            subjects: [],
            status: bill.status,
            lastAction: bill.lastAction,
            lastActionDate: bill.lastActionDate,
          },
        });
        created++;
      }
    } catch (error) {
      console.error(`Error syncing ${bill.billId}:`, error);
      errors++;
    }
  }

  return { created, updated, errors };
}

// GET - Triggered by Vercel Cron
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get('authorization');
  const cronHeader = request.headers.get('x-vercel-cron');

  // Allow if it's a Vercel cron job OR has valid auth
  if (!cronHeader && authHeader !== `Bearer ${SYNC_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get settings from database
  const [sessionCode, sessionName, maxBills, batchDelay, syncEnabled] = await Promise.all([
    getSetting('SESSION_CODE'),
    getSetting('SESSION_NAME'),
    getSettingTyped<number>('MAX_BILLS_PER_SYNC'),
    getSettingTyped<number>('BATCH_DELAY_MS'),
    getSettingTyped<boolean>('SYNC_ENABLED'),
  ]);

  // Check if sync is enabled
  if (syncEnabled === false) {
    return NextResponse.json(
      { error: 'Sync is disabled in settings' },
      { status: 400 }
    );
  }

  console.log('Starting bill sync...');
  const startTime = Date.now();

  try {
    // Fetch bills from Texas Legislature
    const bills = await fetchBillsFromLegislature(
      sessionCode || '89R',
      maxBills || 100,
      batchDelay || 500
    );
    console.log(`Fetched ${bills.length} bills from legislature`);

    // Sync to database
    const result = await syncBillsToDatabase(
      bills,
      sessionCode || '89R',
      sessionName || '89th Regular Session'
    );

    const duration = Date.now() - startTime;

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      bills: {
        fetched: bills.length,
        created: result.created,
        updated: result.updated,
        errors: result.errors,
      },
      settings: {
        sessionCode,
        maxBills,
        batchDelay,
      },
    };

    console.log('Sync complete:', summary);

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Sync failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// POST - Manual trigger with optional parameters
export async function POST(request: NextRequest) {
  // Verify secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${SYNC_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Same logic as GET
  return GET(request);
}
