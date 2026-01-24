import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { BillType } from '@prisma/client';
import { getSettingTyped, getSetting } from '@/lib/admin/settings';

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
 */
async function fetchBillsFromLegislature(
  sessionCode: string,
  maxBills: number,
  batchDelay: number,
  billTypes: BillType[]
): Promise<BillData[]> {
  const bills: BillData[] = [];

  for (const billType of billTypes) {
    try {
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

      const numbers = Array.from(billNumbers).sort((a, b) => a - b);

      for (let i = 0; i < Math.min(numbers.length, maxBills / billTypes.length); i++) {
        const billNum = numbers[i];
        const billData = await fetchBillDetails(sessionCode, billType, billNum);
        if (billData) {
          bills.push(billData);
        }

        if (i % 10 === 9) {
          await new Promise((resolve) => setTimeout(resolve, batchDelay));
        }
      }
    } catch (error) {
      console.error(`Error fetching ${billType} bills:`, error);
    }
  }

  return bills;
}

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

    const captionMatch =
      html.match(/Caption[^>]*>([^<]+)/i) ||
      html.match(/<span[^>]*id="[^"]*Caption[^"]*"[^>]*>([^<]+)/i);
    const description = captionMatch ? captionMatch[1].trim() : `${billType} ${billNumber}`;

    const authorMatch = html.match(/Author[^>]*>([^<]+)/i);
    const authors = authorMatch ? [authorMatch[1].trim()] : [];

    // Last Action is in format: <strong>Last Action:</strong>\n<em>DATE CHAMBER Action text</em>
    const lastActionMatch = html.match(/<strong>Last Action:<\/strong>\s*<em>([^<]+)<\/em>/i);
    let lastAction = '';
    let lastActionDate: Date | null = null;
    if (lastActionMatch) {
      // Extract just the action text, stripping the leading date/chamber prefix
      // Format: "02/25/2025 H Referred to Appropriations: Feb 25 2025 3:35PM"
      const rawAction = lastActionMatch[1].trim();

      // Extract the date from the beginning (MM/DD/YYYY format)
      const dateMatch = rawAction.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (dateMatch) {
        const [, month, day, year] = dateMatch;
        lastActionDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }

      // Remove the date prefix (MM/DD/YYYY) and chamber letter (H/S) to get cleaner action text
      const cleanedAction = rawAction.replace(/^\d{2}\/\d{2}\/\d{4}\s+[HS]\s+/, '');
      lastAction = cleanedAction;
    }

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
      description: description.substring(0, 2000),
      authors,
      status,
      lastAction: lastAction.substring(0, 500),
      lastActionDate,
    };
  } catch (error) {
    console.error(`Error fetching ${billType} ${billNumber}:`, error);
    return null;
  }
}

async function syncBillsToDatabase(
  bills: BillData[],
  sessionCode: string,
  sessionName: string
): Promise<{ created: number; updated: number; errors: number }> {
  let created = 0;
  let updated = 0;
  let errors = 0;

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

// POST /api/admin/sync/trigger - Trigger manual sync
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get settings from database
    const [sessionCode, sessionName, maxBills, batchDelay, syncEnabled] = await Promise.all([
      getSetting('SESSION_CODE'),
      getSetting('SESSION_NAME'),
      getSettingTyped<number>('MAX_BILLS_PER_SYNC'),
      getSettingTyped<number>('BATCH_DELAY_MS'),
      getSettingTyped<boolean>('SYNC_ENABLED'),
    ]);

    if (syncEnabled === false) {
      return NextResponse.json(
        { error: 'Sync is disabled. Enable it in settings first.' },
        { status: 400 }
      );
    }

    // Get optional parameters from request
    const body = await request.json().catch(() => ({}));
    const requestedMaxBills = body.maxBills || maxBills || 100;
    const billTypesParam = body.billTypes as BillType[] | undefined;
    const billTypes: BillType[] = billTypesParam || ['HB', 'SB'];

    console.log('Starting admin-triggered bill sync...');
    const startTime = Date.now();

    const bills = await fetchBillsFromLegislature(
      sessionCode || '89R',
      requestedMaxBills,
      batchDelay || 500,
      billTypes
    );

    console.log(`Fetched ${bills.length} bills from legislature`);

    const result = await syncBillsToDatabase(
      bills,
      sessionCode || '89R',
      sessionName || '89th Regular Session'
    );

    const duration = Date.now() - startTime;

    const summary = {
      success: true,
      triggeredBy: session.user.email,
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
        maxBills: requestedMaxBills,
        billTypes,
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
