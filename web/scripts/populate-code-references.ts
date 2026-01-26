/**
 * Populate Code References Script
 *
 * Backfills the BillCodeReference table by parsing code references
 * from existing bill content.
 *
 * Run with: npx tsx scripts/populate-code-references.ts
 */

import { PrismaClient, CodeReferenceAction } from '@prisma/client';
import { parseCodeReferences, CodeReference } from '../lib/parsers/code-reference-parser';

const prisma = new PrismaClient();
const BATCH_SIZE = 100;

interface Stats {
  billsProcessed: number;
  referencesCreated: number;
  billsWithReferences: number;
  errors: number;
}

function mapAction(action: 'add' | 'amend' | 'repeal'): CodeReferenceAction {
  switch (action) {
    case 'add':
      return 'ADD';
    case 'amend':
      return 'AMEND';
    case 'repeal':
      return 'REPEAL';
    default:
      return 'AMEND';
  }
}

async function populateCodeReferences() {
  console.log('═'.repeat(60));
  console.log('POPULATE CODE REFERENCES');
  console.log('═'.repeat(60));

  const stats: Stats = {
    billsProcessed: 0,
    referencesCreated: 0,
    billsWithReferences: 0,
    errors: 0,
  };

  const startTime = Date.now();

  try {
    // Get count of bills with content
    const totalBills = await prisma.bill.count({
      where: { content: { not: null } },
    });
    console.log(`\nFound ${totalBills} bills with content\n`);

    // Clear existing references (optional - comment out to append)
    console.log('Clearing existing code references...');
    const deleted = await prisma.billCodeReference.deleteMany();
    console.log(`Deleted ${deleted.count} existing references\n`);

    // Process bills in batches
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const bills = await prisma.bill.findMany({
        where: { content: { not: null } },
        select: {
          id: true,
          billId: true,
          content: true,
        },
        skip,
        take: BATCH_SIZE,
        orderBy: { billNumber: 'asc' },
      });

      if (bills.length === 0) {
        hasMore = false;
        break;
      }

      for (const bill of bills) {
        try {
          if (!bill.content) continue;

          const references = parseCodeReferences(bill.content);

          if (references.length > 0) {
            // Create references in database
            await prisma.billCodeReference.createMany({
              data: references.map((ref: CodeReference) => ({
                billId: bill.id,
                code: ref.code,
                title: ref.title || null,
                chapter: ref.chapter || '',
                subchapter: ref.subchapter || null,
                section: ref.section,
                subsections: ref.subsections || [],
                action: mapAction(ref.action),
                billSection: ref.billSection,
              })),
              skipDuplicates: true,
            });

            stats.referencesCreated += references.length;
            stats.billsWithReferences++;
          }

          stats.billsProcessed++;

          // Progress update
          if (stats.billsProcessed % 100 === 0) {
            const elapsed = (Date.now() - startTime) / 1000;
            const rate = stats.billsProcessed / elapsed;
            const eta = (totalBills - stats.billsProcessed) / rate;
            process.stdout.write(
              `\r${stats.billsProcessed}/${totalBills} bills | ` +
              `${stats.referencesCreated} refs | ` +
              `${rate.toFixed(1)}/s | ETA: ${eta.toFixed(0)}s   `
            );
          }
        } catch (error) {
          stats.errors++;
          console.error(`\nError processing ${bill.billId}:`, error);
        }
      }

      skip += BATCH_SIZE;
    }

    // Final summary
    const elapsed = (Date.now() - startTime) / 1000;
    console.log('\n\n' + '═'.repeat(60));
    console.log('COMPLETE');
    console.log('═'.repeat(60));
    console.log(`Duration: ${elapsed.toFixed(1)}s`);
    console.log(`Bills processed: ${stats.billsProcessed}`);
    console.log(`Bills with references: ${stats.billsWithReferences}`);
    console.log(`References created: ${stats.referencesCreated}`);
    console.log(`Errors: ${stats.errors}`);

    // Show top codes
    console.log('\n--- Top 10 Texas Codes Referenced ---');
    const topCodes = await prisma.billCodeReference.groupBy({
      by: ['code'],
      _count: { code: true },
      orderBy: { _count: { code: 'desc' } },
      take: 10,
    });
    for (const item of topCodes) {
      console.log(`  ${item.code}: ${item._count.code} references`);
    }

    // Show action distribution
    console.log('\n--- Actions Distribution ---');
    const actionCounts = await prisma.billCodeReference.groupBy({
      by: ['action'],
      _count: { action: true },
    });
    for (const item of actionCounts) {
      console.log(`  ${item.action}: ${item._count.action}`);
    }

  } finally {
    await prisma.$disconnect();
  }
}

populateCodeReferences().catch(console.error);
