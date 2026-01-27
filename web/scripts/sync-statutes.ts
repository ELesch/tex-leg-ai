/**
 * Statute Sync Script
 * Syncs Texas statutes from statutes.capitol.texas.gov
 *
 * The Texas statutes website uses a modern SPA architecture, so this script
 * uses HTTP fetching with chapter discovery pattern. The website provides
 * server-side rendered content that can be parsed.
 *
 * Run with: npx tsx scripts/sync-statutes.ts [CODE]
 * Example: npx tsx scripts/sync-statutes.ts ED
 *
 * Options:
 *   [CODE] - Optional: Sync specific code only (e.g., ED, GV, PE)
 *            If not specified, syncs all codes
 */

import { PrismaClient, SyncJobStatus } from '@prisma/client';
import { TEXAS_CODES, getChapterUrl, getCodeName } from '../lib/statutes/texas-codes';
import {
  parseChapterHtml,
  ParsedSection,
  extractTextFromHtml,
  extractChapterFromSection,
} from '../lib/statutes/statute-parser';

const prisma = new PrismaClient();

// Configuration
const NUM_WORKERS = 4;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const MAX_CONSECUTIVE_404 = 10; // Stop chapter discovery after N consecutive 404s

interface SyncStats {
  processed: number;
  created: number;
  updated: number;
  errors: number;
  skipped: number;
}

interface ChapterTask {
  codeId: string;
  codeAbbreviation: string;
  chapterNum: number;
}

/**
 * Fetch HTML content from URL with retry logic
 */
async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TexLegAI/1.0; +https://texlegai.vercel.app)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });

      if (response.status === 404) {
        return null; // Chapter doesn't exist
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      if (attempt === retries) {
        console.error(`  Failed to fetch ${url} after ${retries} attempts:`, error);
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }
  return null;
}

/**
 * Parse sections from chapter HTML using regex patterns
 * The Texas statutes website uses SSR, so content is in the HTML
 */
function parseStatuteSections(html: string, chapterNum: string): ParsedSection[] {
  const sections: ParsedSection[] = [];

  // The Angular SSR embeds content. Look for section patterns in the HTML
  // Format: Sec. X.XXX. HEADING. followed by text content

  // First, try to find the main content area
  const contentMatch = html.match(/<app-doc-viewer[^>]*>([\s\S]*?)<\/app-doc-viewer>/i);
  if (!contentMatch) {
    // Try alternative patterns for extracting statute content
    // Look for any section markers in the full HTML
  }

  // Pattern to match statute sections
  // Sec. 29.001. DEFINITIONS. (a) In this chapter:
  const sectionRegex = /Sec\.\s*(\d+\.\d+[A-Za-z]?)\.\s*([A-Z][A-Z\s,;'\-()&]+?)\.\s*(\([a-z0-9]+\)[\s\S]*?)(?=Sec\.\s*\d+\.\d+|$)/gi;

  let match;
  while ((match = sectionRegex.exec(html)) !== null) {
    const sectionNum = match[1];
    const heading = match[2].trim();
    const content = match[3].trim();

    sections.push({
      sectionNum,
      heading,
      text: extractTextFromHtml(content),
      textHtml: content,
      chapterNum: extractChapterFromSection(sectionNum),
      subchapter: null,
      subchapterTitle: null,
    });
  }

  // If no sections found with full pattern, try simpler extraction
  if (sections.length === 0) {
    const simpleRegex = /Sec\.\s*(\d+\.\d+[A-Za-z]?)\.\s*([A-Z][^.]+)\./g;
    while ((match = simpleRegex.exec(html)) !== null) {
      sections.push({
        sectionNum: match[1],
        heading: match[2].trim(),
        text: `[Full text available at statutes.capitol.texas.gov]`,
        textHtml: null,
        chapterNum: extractChapterFromSection(match[1]),
        subchapter: null,
        subchapterTitle: null,
      });
    }
  }

  return sections;
}

/**
 * Initialize Texas Codes in database
 */
async function initializeTexasCodes(): Promise<Map<string, string>> {
  const codeIdMap = new Map<string, string>();

  for (const code of TEXAS_CODES) {
    const result = await prisma.texasCode.upsert({
      where: { abbreviation: code.abbreviation },
      create: {
        abbreviation: code.abbreviation,
        name: code.name,
      },
      update: {
        name: code.name,
      },
    });
    codeIdMap.set(code.abbreviation, result.id);
  }

  return codeIdMap;
}

/**
 * Known chapter ranges for each Texas code
 * Since the website is a SPA, HEAD requests don't work for discovery
 * These ranges cover the typical chapter numbers for each code
 */
const CODE_CHAPTER_RANGES: Record<string, number[]> = {
  'AG': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250],
  'ED': Array.from({ length: 150 }, (_, i) => i + 1), // Education Code chapters 1-150
  'GV': Array.from({ length: 3000 }, (_, i) => i + 1), // Government Code has many chapters
  'PE': Array.from({ length: 100 }, (_, i) => i + 1), // Penal Code
  'FA': Array.from({ length: 300 }, (_, i) => i + 1), // Family Code
  'HS': Array.from({ length: 1000 }, (_, i) => i + 1), // Health & Safety Code
  'DEFAULT': Array.from({ length: 500 }, (_, i) => i + 1), // Default range for unknown codes
};

/**
 * Get chapters to sync for a code - uses known ranges
 */
async function discoverChapters(codeAbbreviation: string): Promise<number[]> {
  const chapters = CODE_CHAPTER_RANGES[codeAbbreviation] || CODE_CHAPTER_RANGES['DEFAULT'];
  console.log(`  Using predefined range: chapters 1-${chapters[chapters.length - 1]} for ${codeAbbreviation}`);
  return chapters;
}

/**
 * Process a single chapter - fetch and save sections
 */
async function processChapter(
  task: ChapterTask,
  stats: SyncStats
): Promise<void> {
  const url = getChapterUrl(task.codeAbbreviation, String(task.chapterNum));
  const html = await fetchWithRetry(url);

  if (!html) {
    stats.skipped++;
    return;
  }

  const sections = parseStatuteSections(html, String(task.chapterNum));

  if (sections.length === 0) {
    stats.skipped++;
    return;
  }

  for (const section of sections) {
    try {
      const existing = await prisma.statute.findFirst({
        where: {
          codeId: task.codeId,
          sectionNum: section.sectionNum,
          isCurrent: true,
        },
      });

      if (existing) {
        // Update if text changed
        if (existing.text !== section.text) {
          await prisma.statute.update({
            where: { id: existing.id },
            data: {
              text: section.text,
              textHtml: section.textHtml,
              heading: section.heading,
              subchapter: section.subchapter,
              subchapterTitle: section.subchapterTitle,
            },
          });
          stats.updated++;
        }
      } else {
        await prisma.statute.create({
          data: {
            codeId: task.codeId,
            chapterNum: section.chapterNum,
            sectionNum: section.sectionNum,
            heading: section.heading,
            text: section.text,
            textHtml: section.textHtml,
            subchapter: section.subchapter,
            subchapterTitle: section.subchapterTitle,
            version: 1,
            isCurrent: true,
            sourceUrl: url,
          },
        });
        stats.created++;
      }

      stats.processed++;
    } catch (error) {
      console.error(`    Error processing ${task.codeAbbreviation} ${section.sectionNum}:`, error);
      stats.errors++;
    }
  }
}

/**
 * Worker function to process chapters in parallel
 */
async function worker(
  workerId: number,
  tasks: ChapterTask[],
  stats: SyncStats,
  onProgress: () => void
): Promise<void> {
  for (const task of tasks) {
    await processChapter(task, stats);
    onProgress();
  }
}

/**
 * Update code section counts
 */
async function updateCodeCounts(codeIdMap: Map<string, string>): Promise<void> {
  for (const [abbr, id] of codeIdMap) {
    const count = await prisma.statute.count({
      where: { codeId: id, isCurrent: true },
    });

    await prisma.texasCode.update({
      where: { id },
      data: {
        sectionCount: count,
        lastSyncedAt: new Date(),
      },
    });
  }
}

/**
 * Main sync function
 */
async function main() {
  const targetCode = process.argv[2]?.toUpperCase();

  console.log('═'.repeat(60));
  console.log('TEXAS STATUTES SYNC');
  console.log('═'.repeat(60));

  if (targetCode) {
    const validCode = TEXAS_CODES.find(c => c.abbreviation === targetCode);
    if (!validCode) {
      console.error(`Invalid code: ${targetCode}`);
      console.log('Valid codes:', TEXAS_CODES.map(c => c.abbreviation).join(', '));
      process.exit(1);
    }
    console.log(`Target: ${targetCode} (${validCode.name})`);
  } else {
    console.log(`Target: All ${TEXAS_CODES.length} Texas Codes`);
  }

  const stats: SyncStats = {
    processed: 0,
    created: 0,
    updated: 0,
    errors: 0,
    skipped: 0,
  };

  const startTime = Date.now();

  try {
    // Create sync job
    const syncJob = await prisma.statuteSyncJob.create({
      data: {
        status: SyncJobStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    // Initialize codes
    console.log('\nInitializing Texas Codes...');
    const codeIdMap = await initializeTexasCodes();
    console.log(`  ${codeIdMap.size} codes initialized`);

    // Determine which codes to sync
    const codesToSync = targetCode
      ? [{ abbreviation: targetCode, name: getCodeName(targetCode)! }]
      : [...TEXAS_CODES];

    // Process each code
    for (const code of codesToSync) {
      console.log(`\n${'─'.repeat(40)}`);
      console.log(`Processing: ${code.abbreviation} - ${code.name}`);
      console.log('─'.repeat(40));

      await prisma.statuteSyncJob.update({
        where: { id: syncJob.id },
        data: { currentCode: code.abbreviation },
      });

      const codeId = codeIdMap.get(code.abbreviation)!;

      // Discover chapters
      const chapters = await discoverChapters(code.abbreviation);

      if (chapters.length === 0) {
        console.log(`  No chapters found for ${code.abbreviation}`);
        continue;
      }

      // Create tasks for each chapter
      const tasks: ChapterTask[] = chapters.map(chapterNum => ({
        codeId,
        codeAbbreviation: code.abbreviation,
        chapterNum,
      }));

      // Distribute tasks among workers
      const perWorker = Math.ceil(tasks.length / NUM_WORKERS);
      const workerTasks = Array.from({ length: NUM_WORKERS }, (_, i) =>
        tasks.slice(i * perWorker, (i + 1) * perWorker)
      ).filter(t => t.length > 0);

      // Progress display
      const total = tasks.length;
      let completed = 0;
      const showProgress = () => {
        completed++;
        if (completed % 5 === 0 || completed === total) {
          const elapsed = (Date.now() - startTime) / 1000;
          process.stdout.write(
            `\r  Progress: ${completed}/${total} chapters | ` +
            `Created: ${stats.created} | Updated: ${stats.updated} | Errors: ${stats.errors}    `
          );
        }
      };

      // Run workers in parallel
      await Promise.all(
        workerTasks.map((tasks, i) => worker(i, tasks, stats, showProgress))
      );

      console.log(); // New line after progress

      // Update progress in sync job
      const currentJob = await prisma.statuteSyncJob.findUnique({ where: { id: syncJob.id } });
      const existingCodes = typeof currentJob?.completedCodes === 'string'
        ? JSON.parse(currentJob.completedCodes)
        : currentJob?.completedCodes || [];

      await prisma.statuteSyncJob.update({
        where: { id: syncJob.id },
        data: {
          totalProcessed: stats.processed,
          totalCreated: stats.created,
          totalErrors: stats.errors,
          completedCodes: JSON.stringify([...existingCodes, code.abbreviation]),
        },
      });
    }

    // Update section counts
    console.log('\nUpdating section counts...');
    await updateCodeCounts(codeIdMap);

    // Complete sync job
    await prisma.statuteSyncJob.update({
      where: { id: syncJob.id },
      data: {
        status: SyncJobStatus.COMPLETED,
        completedAt: new Date(),
        currentCode: null,
      },
    });

    // Summary
    const elapsed = (Date.now() - startTime) / 1000;
    console.log('\n' + '═'.repeat(60));
    console.log('SYNC COMPLETE');
    console.log('═'.repeat(60));
    console.log(`Duration: ${elapsed.toFixed(1)}s`);
    console.log(`Processed: ${stats.processed}`);
    console.log(`Created: ${stats.created}`);
    console.log(`Updated: ${stats.updated}`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);

    // Show database stats
    const totalSections = await prisma.statute.count({ where: { isCurrent: true } });
    console.log(`\nDatabase: ${totalSections} current statute sections`);

  } catch (error) {
    console.error('\nSync failed:', error);

    // Update sync job with error
    await prisma.statuteSyncJob.updateMany({
      where: { status: SyncJobStatus.RUNNING },
      data: {
        status: SyncJobStatus.ERROR,
        lastError: String(error),
      },
    });

    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
