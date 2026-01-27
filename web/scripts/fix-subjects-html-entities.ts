/**
 * Fix HTML entities in bill subjects
 *
 * This script finds all bills with HTML entities in their subjects
 * (like &amp; instead of &) and decodes them.
 *
 * Usage: npx tsx scripts/fix-subjects-html-entities.ts
 */

import { PrismaClient } from '@prisma/client';
import { decodeHtmlEntities } from '../lib/admin/sync/xml-parser';

const prisma = new PrismaClient();

// Common HTML entities to look for
const HTML_ENTITY_PATTERN = /&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/i;

async function fixSubjectsHtmlEntities() {
  console.log('Scanning bills for HTML entities in subjects...\n');

  // Find all bills with subjects that might contain HTML entities
  // We fetch all bills with subjects and filter in JS since Postgres array
  // element matching with regex is complex
  const bills = await prisma.bill.findMany({
    where: {
      subjects: { isEmpty: false }
    },
    select: {
      id: true,
      billId: true,
      subjects: true,
    }
  });

  console.log(`Found ${bills.length} bills with subjects`);

  // Filter to only bills that need fixing
  const billsToFix = bills.filter(bill =>
    bill.subjects.some(subject => HTML_ENTITY_PATTERN.test(subject))
  );

  console.log(`Found ${billsToFix.length} bills with HTML entities to fix\n`);

  if (billsToFix.length === 0) {
    console.log('No bills need updating - subjects are already clean!');
    return;
  }

  // Show examples of what will be fixed
  const examples: { billId: string; before: string; after: string }[] = [];
  for (const bill of billsToFix.slice(0, 5)) {
    for (const subject of bill.subjects) {
      if (HTML_ENTITY_PATTERN.test(subject)) {
        examples.push({
          billId: bill.billId,
          before: subject,
          after: decodeHtmlEntities(subject),
        });
        break;
      }
    }
  }

  console.log('Examples of fixes to be applied:');
  for (const example of examples) {
    console.log(`  ${example.billId}:`);
    console.log(`    Before: "${example.before}"`);
    console.log(`    After:  "${example.after}"`);
  }
  console.log('');

  // Batch update using transactions
  const BATCH_SIZE = 100;
  let updatedCount = 0;
  let totalSubjectsFixed = 0;

  for (let i = 0; i < billsToFix.length; i += BATCH_SIZE) {
    const batch = billsToFix.slice(i, i + BATCH_SIZE);

    await prisma.$transaction(
      batch.map(bill => {
        const decodedSubjects = bill.subjects.map(subject => decodeHtmlEntities(subject));

        // Count subjects fixed in this bill
        bill.subjects.forEach((subject, idx) => {
          if (subject !== decodedSubjects[idx]) {
            totalSubjectsFixed++;
          }
        });

        return prisma.bill.update({
          where: { id: bill.id },
          data: { subjects: decodedSubjects },
        });
      })
    );

    updatedCount += batch.length;
    process.stdout.write(`\rUpdated ${updatedCount}/${billsToFix.length} bills...`);
  }

  console.log('\n\n=== Results ===\n');
  console.log(`Bills updated: ${updatedCount}`);
  console.log(`Total subjects fixed: ${totalSubjectsFixed}`);
}

fixSubjectsHtmlEntities()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
