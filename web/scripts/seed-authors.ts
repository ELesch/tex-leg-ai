/**
 * Author Seed Script
 *
 * Extracts unique author names from Bill.authors and creates Author records.
 * Infers chamber (HOUSE/SENATE) from name prefix (Rep./Sen.).
 *
 * Usage: npx tsx scripts/seed-authors.ts
 */

import { PrismaClient, Chamber } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Infer chamber from author name prefix
 */
function inferChamber(name: string): Chamber | null {
  const lowerName = name.toLowerCase();
  if (
    lowerName.startsWith('rep.') ||
    lowerName.startsWith('representative')
  ) {
    return 'HOUSE';
  }
  if (lowerName.startsWith('sen.') || lowerName.startsWith('senator')) {
    return 'SENATE';
  }
  return null;
}

/**
 * Extract display name (remove prefix)
 */
function getDisplayName(name: string): string | null {
  // Remove common prefixes
  const prefixes = [
    'Rep. ',
    'Rep.',
    'Representative ',
    'Sen. ',
    'Sen.',
    'Senator ',
  ];

  for (const prefix of prefixes) {
    if (name.startsWith(prefix)) {
      return name.slice(prefix.length).trim();
    }
  }

  return null;
}

/**
 * Main seeding function
 */
async function seedAuthors() {
  console.log('='.repeat(60));
  console.log('TexLegAI Author Seeding');
  console.log('='.repeat(60));

  // Step 1: Get all unique author names from bills
  console.log('\n[1/3] Extracting unique author names from bills...');

  const bills = await prisma.bill.findMany({
    select: {
      authors: true,
    },
  });

  // Collect unique author names
  const authorNamesSet = new Set<string>();
  for (const bill of bills) {
    for (const author of bill.authors) {
      if (author && author.trim()) {
        authorNamesSet.add(author.trim());
      }
    }
  }

  const authorNames = Array.from(authorNamesSet).sort();
  console.log(`  Found ${authorNames.length} unique author names`);

  // Step 2: Get existing authors to avoid duplicates
  console.log('\n[2/3] Checking for existing author records...');

  const existingAuthors = await prisma.author.findMany({
    select: { name: true },
  });
  const existingNames = new Set(existingAuthors.map((a) => a.name));
  console.log(`  Found ${existingNames.size} existing author records`);

  // Step 3: Create new Author records
  console.log('\n[3/3] Creating new Author records...');

  let created = 0;
  let skipped = 0;

  for (const name of authorNames) {
    if (existingNames.has(name)) {
      skipped++;
      continue;
    }

    try {
      await prisma.author.create({
        data: {
          name,
          displayName: getDisplayName(name),
          chamber: inferChamber(name),
        },
      });
      created++;
      console.log(`  Created: ${name}`);
    } catch (error) {
      console.error(`  Error creating author "${name}":`, error);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Author Seeding Complete!');
  console.log('='.repeat(60));

  const totalAuthors = await prisma.author.count();

  console.log(`\nSummary:`);
  console.log(`  - New authors created: ${created}`);
  console.log(`  - Already existed: ${skipped}`);
  console.log(`  - Total authors in database: ${totalAuthors}`);

  // Show breakdown by chamber
  const houseCounts = await prisma.author.count({
    where: { chamber: 'HOUSE' },
  });
  const senateCounts = await prisma.author.count({
    where: { chamber: 'SENATE' },
  });
  const unknownCounts = await prisma.author.count({
    where: { chamber: null },
  });

  console.log(`\nBy chamber:`);
  console.log(`  - House: ${houseCounts}`);
  console.log(`  - Senate: ${senateCounts}`);
  console.log(`  - Unknown: ${unknownCounts}`);
}

// Run seeding
seedAuthors()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
