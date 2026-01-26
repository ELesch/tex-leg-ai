/**
 * Full Bill Sync Script - FTP Only with Auto-Reconnect
 * Fetches metadata XML and bill text HTML directly from FTP
 * Uses parallel connections with automatic reconnection on errors
 *
 * Run with: npx tsx scripts/full-sync.ts
 */

import { Client } from 'basic-ftp';
import { Writable } from 'stream';
import { PrismaClient, BillType, CodeReferenceAction } from '@prisma/client';
import { parseBillXml } from '../lib/admin/sync/xml-parser';
import { parseCodeReferences, CodeReference } from '../lib/parsers/code-reference-parser';

const FTP_HOST = 'ftp.legis.state.tx.us';
const SESSION_CODE = '89R';
const SESSION_NAME = '89th Regular Session';
const NUM_WORKERS = 4; // Reduced for stability
const BILL_TYPES: BillType[] = ['HB', 'SB'];
const MAX_RETRIES = 3;

const prisma = new PrismaClient();

function mapCodeReferenceAction(action: 'add' | 'amend' | 'repeal'): CodeReferenceAction {
  switch (action) {
    case 'add': return 'ADD';
    case 'amend': return 'AMEND';
    case 'repeal': return 'REPEAL';
    default: return 'AMEND';
  }
}

async function saveCodeReferences(billDbId: string, content: string | null): Promise<void> {
  if (!content) return;

  try {
    const references = parseCodeReferences(content);
    if (references.length === 0) return;

    // Delete existing references for this bill
    await prisma.billCodeReference.deleteMany({
      where: { billId: billDbId },
    });

    // Create new references
    await prisma.billCodeReference.createMany({
      data: references.map((ref: CodeReference) => ({
        billId: billDbId,
        code: ref.code,
        title: ref.title || null,
        chapter: ref.chapter || '',
        subchapter: ref.subchapter || null,
        section: ref.section,
        subsections: ref.subsections || [],
        action: mapCodeReferenceAction(ref.action),
        billSection: ref.billSection,
      })),
      skipDuplicates: true,
    });
  } catch (error) {
    // Silently ignore errors to not slow down sync
  }
}

interface BillTask {
  billType: BillType;
  billNumber: number;
  billId: string;
}

interface SyncStats {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  processed: number;
}

function createWritable(): { writable: Writable; toString: () => string } {
  const chunks: Buffer[] = [];
  const writable = new Writable({
    write(chunk: Buffer, _: string, cb: () => void) { chunks.push(chunk); cb(); }
  });
  return { writable, toString: () => Buffer.concat(chunks).toString('utf-8') };
}

function getDirectoryRange(billType: string, billNumber: number): string {
  if (billNumber <= 99) {
    return `${billType}00001_${billType}00099`;
  }
  const rangeStart = Math.floor((billNumber - 100) / 100) * 100 + 100;
  const rangeEnd = rangeStart + 99;
  return `${billType}${rangeStart.toString().padStart(5, '0')}_${billType}${rangeEnd.toString().padStart(5, '0')}`;
}

function getBillTypePath(billType: string): string {
  return ['HB', 'HJR', 'HCR'].includes(billType.toUpperCase()) ? 'house_bills' : 'senate_bills';
}

function extractTextFromHtml(html: string): string {
  let text = html
    // Remove script and style
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Convert block elements to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&#xA0;/gi, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#x26;/gi, '&')
    .replace(/&#38;/g, '&')
    .replace(/&amp;/gi, '&')
    .replace(/&#x3C;/gi, '<')
    .replace(/&#60;/g, '<')
    .replace(/&lt;/gi, '<')
    .replace(/&#x3E;/gi, '>')
    .replace(/&#62;/g, '>')
    .replace(/&gt;/gi, '>')
    .replace(/&#x22;/gi, '"')
    .replace(/&#34;/g, '"')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#x2014;/gi, '—')
    .replace(/&#8212;/g, '—')
    .replace(/&mdash;/gi, '—')
    .replace(/&#x2013;/gi, '–')
    .replace(/&#8211;/g, '–')
    .replace(/&ndash;/gi, '–')
    .replace(/&#xA7;/gi, '§')
    .replace(/&#167;/g, '§')
    .replace(/&sect;/gi, '§')
    // Generic hex entity decoder
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    // Generic decimal entity decoder
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    // Clean up whitespace
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/^ +/gm, '')
    .replace(/ +$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Remove leading metadata noise - find actual bill content
  const contentStart = text.search(/\d+\(R\)|A BILL TO BE ENTITLED|AN ACT/i);
  if (contentStart > 0 && contentStart < 500) {
    text = text.substring(contentStart);
  }

  // If it's a placeholder page, return the message
  if (text.includes('An HTML version of this bill is not available')) {
    const match = text.match(/An HTML version of this bill is not available[^.]*\./);
    if (match) {
      return match[0];
    }
  }

  return text.substring(0, 50000);
}

async function createFtpClient(): Promise<Client> {
  const client = new Client();
  client.ftp.verbose = false;
  await client.access({ host: FTP_HOST, secure: false });
  return client;
}

async function scanBills(client: Client, billType: BillType): Promise<number[]> {
  const billNumbers: number[] = [];
  const basePath = `/bills/${SESSION_CODE}/billhistory/${getBillTypePath(billType)}`;

  try {
    const dirs = await client.list(basePath);
    const pattern = new RegExp(`^${billType}\\d{5}_${billType}\\d{5}$`);

    for (const dir of dirs.filter(d => d.isDirectory && pattern.test(d.name))) {
      const files = await client.list(`${basePath}/${dir.name}`);
      for (const f of files) {
        if (f.name.endsWith('.xml')) {
          const match = f.name.match(/(\d+)/);
          if (match) billNumbers.push(parseInt(match[1]));
        }
      }
    }
  } catch (e) {
    console.error(`Error scanning ${billType}:`, e);
  }

  return billNumbers.sort((a, b) => a - b);
}

async function processBill(
  client: Client,
  task: BillTask,
  sessionId: string
): Promise<{ success: boolean; created: boolean; updated: boolean; skipped: boolean; needsReconnect: boolean }> {
  const billTypePath = getBillTypePath(task.billType);
  const dirRange = getDirectoryRange(task.billType, task.billNumber);

  // Fetch XML metadata
  const xmlPath = `/bills/${SESSION_CODE}/billhistory/${billTypePath}/${dirRange}/${task.billType} ${task.billNumber}.xml`;
  const xmlStream = createWritable();

  try {
    await client.downloadTo(xmlStream.writable, xmlPath);
  } catch (e: any) {
    if (e.code === 550) {
      return { success: true, created: false, updated: false, skipped: true, needsReconnect: false };
    }
    // Connection error - needs reconnect
    if (e.message?.includes('ECONNRESET') || e.message?.includes('closed')) {
      return { success: false, created: false, updated: false, skipped: false, needsReconnect: true };
    }
    throw e;
  }

  const xml = xmlStream.toString();
  const parsed = parseBillXml(xml, task.billType, task.billNumber);
  if (!parsed) {
    return { success: false, created: false, updated: false, skipped: false, needsReconnect: false };
  }

  // Fetch HTML bill text from FTP
  let content: string | null = null;
  const paddedNum = task.billNumber.toString().padStart(5, '0');
  const htmlDir = `/bills/${SESSION_CODE}/billtext/html/${billTypePath}/${dirRange}`;

  // Try different versions: E=Engrossed, F=Final, S=Senate, H=House, I=Introduced
  for (const suffix of ['E', 'F', 'S', 'H', 'I']) {
    const htmlPath = `${htmlDir}/${task.billType}${paddedNum}${suffix}.htm`;
    const htmlStream = createWritable();
    try {
      await client.downloadTo(htmlStream.writable, htmlPath);
      const html = htmlStream.toString();
      if (html.length > 100) {
        content = extractTextFromHtml(html);
        break;
      }
    } catch (e: any) {
      // Connection error - needs reconnect
      if (e.message?.includes('ECONNRESET') || e.message?.includes('closed')) {
        return { success: false, created: false, updated: false, skipped: false, needsReconnect: true };
      }
      // Try next version (550 = file not found)
    }
  }

  // Get committee info
  let committeeName: string | null = null;
  let committeeStatus: string | null = null;
  if (parsed.committees?.length > 0) {
    const comm = parsed.committees.find(c => c.status.toLowerCase().includes('in committee')) || parsed.committees[0];
    committeeName = comm.name;
    committeeStatus = comm.status;
  }

  // Upsert to database
  const existing = await prisma.bill.findUnique({ where: { billId: task.billId }, select: { id: true } });

  const data = {
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

  if (existing) {
    await prisma.bill.update({ where: { billId: task.billId }, data });
    // Parse and save code references
    await saveCodeReferences(existing.id, content);
    return { success: true, created: false, updated: true, skipped: false, needsReconnect: false };
  } else {
    const created = await prisma.bill.create({
      data: {
        ...data,
        sessionId,
        billType: task.billType,
        billNumber: task.billNumber,
        billId: task.billId,
        filename: `${task.billType.toLowerCase()}${task.billNumber}.txt`,
      },
    });
    // Parse and save code references
    await saveCodeReferences(created.id, content);
    return { success: true, created: true, updated: false, skipped: false, needsReconnect: false };
  }
}

async function worker(
  workerId: number,
  tasks: BillTask[],
  sessionId: string,
  stats: SyncStats,
  onProgress: () => void
) {
  let client = await createFtpClient();
  let consecutiveErrors = 0;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    let success = false;
    let retries = 0;

    while (!success && retries < MAX_RETRIES) {
      try {
        const result = await processBill(client, task, sessionId);

        if (result.needsReconnect) {
          // Close old connection and create new one
          try { client.close(); } catch {}
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000)); // Random delay
          client = await createFtpClient();
          retries++;
          continue;
        }

        if (result.success) {
          success = true;
          consecutiveErrors = 0;
          if (result.created) stats.created++;
          else if (result.updated) stats.updated++;
          else if (result.skipped) stats.skipped++;
        } else {
          stats.errors++;
          success = true; // Don't retry parse errors
        }
      } catch (e: any) {
        retries++;
        if (retries >= MAX_RETRIES) {
          stats.errors++;
          console.error(`Error ${task.billId} (after ${MAX_RETRIES} retries):`, e.message);
        } else {
          // Reconnect
          try { client.close(); } catch {}
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
          try {
            client = await createFtpClient();
          } catch (connErr) {
            // Connection failed, wait longer
            await new Promise(resolve => setTimeout(resolve, 5000));
            try {
              client = await createFtpClient();
            } catch {
              // Give up on this task
              stats.errors++;
              console.error(`Error ${task.billId}: Cannot reconnect`);
              success = true;
            }
          }
        }
      }
    }

    stats.processed++;
    onProgress();
  }

  client.close();
}

async function main() {
  console.log('═'.repeat(60));
  console.log('FULL BILL SYNC (FTP Only - Auto-Reconnect)');
  console.log('═'.repeat(60));
  console.log(`Session: ${SESSION_CODE} | Workers: ${NUM_WORKERS} | Max Retries: ${MAX_RETRIES}`);

  const stats: SyncStats = { created: 0, updated: 0, skipped: 0, errors: 0, processed: 0 };
  const startTime = Date.now();

  try {
    // Create session
    const session = await prisma.legislatureSession.upsert({
      where: { code: SESSION_CODE },
      create: { code: SESSION_CODE, name: SESSION_NAME, startDate: new Date('2025-01-14'), isActive: true },
      update: { name: SESSION_NAME, isActive: true },
    });
    console.log(`Session: ${session.id}`);

    // Scan for bills
    console.log('\nScanning FTP...');
    const scanClient = await createFtpClient();

    const allTasks: BillTask[] = [];
    for (const billType of BILL_TYPES) {
      const nums = await scanBills(scanClient, billType);
      console.log(`  ${billType}: ${nums.length} bills`);
      nums.forEach(n => allTasks.push({ billType, billNumber: n, billId: `${billType} ${n}` }));
    }
    scanClient.close();

    console.log(`\nTotal: ${allTasks.length} bills\n`);
    if (allTasks.length === 0) return;

    // Distribute tasks
    const perWorker = Math.ceil(allTasks.length / NUM_WORKERS);
    const workerTasks = Array.from({ length: NUM_WORKERS }, (_, i) =>
      allTasks.slice(i * perWorker, (i + 1) * perWorker)
    ).filter(t => t.length > 0);

    // Progress display
    const total = allTasks.length;
    const showProgress = () => {
      if (stats.processed % 50 === 0 || stats.processed === total) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = stats.processed / elapsed;
        const eta = (total - stats.processed) / rate;
        process.stdout.write(
          `\r${stats.processed}/${total} (${((stats.processed/total)*100).toFixed(1)}%) | ` +
          `${rate.toFixed(1)}/s | ETA: ${eta.toFixed(0)}s | ` +
          `New: ${stats.created} Upd: ${stats.updated} Skip: ${stats.skipped} Err: ${stats.errors}   `
        );
      }
    };

    // Run workers in parallel
    console.log('Syncing...');
    await Promise.all(workerTasks.map((tasks, i) => worker(i, tasks, session.id, stats, showProgress)));

    // Summary
    const elapsed = (Date.now() - startTime) / 1000;
    console.log('\n\n' + '═'.repeat(60));
    console.log('COMPLETE');
    console.log('═'.repeat(60));
    console.log(`Duration: ${elapsed.toFixed(1)}s | Rate: ${(total/elapsed).toFixed(1)}/s`);
    console.log(`Created: ${stats.created} | Updated: ${stats.updated} | Skipped: ${stats.skipped} | Errors: ${stats.errors}`);

    const dbCount = await prisma.bill.count({ where: { session: { code: SESSION_CODE } } });
    console.log(`\nDatabase: ${dbCount} bills for ${SESSION_CODE}`);

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
