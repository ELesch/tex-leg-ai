/**
 * Verify migration - count records in new database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Verifying migration to new database...\n');

  const counts = {
    users: await prisma.user.count(),
    sessions: await prisma.legislatureSession.count(),
    bills: await prisma.bill.count(),
    teams: await prisma.team.count(),
    authors: await prisma.author.count(),
    followedBills: await prisma.followedBill.count(),
    syncJobs: await prisma.syncJob.count(),
  };

  console.log('Record counts:');
  console.log('  Users:', counts.users);
  console.log('  Legislature Sessions:', counts.sessions);
  console.log('  Bills:', counts.bills);
  console.log('  Teams:', counts.teams);
  console.log('  Authors:', counts.authors);
  console.log('  Followed Bills:', counts.followedBills);
  console.log('  Sync Jobs:', counts.syncJobs);

  // Sample some bills to verify content
  const sampleBills = await prisma.bill.findMany({
    take: 3,
    select: {
      billId: true,
      description: true,
      status: true,
    }
  });

  console.log('\nSample bills:');
  sampleBills.forEach(bill => {
    console.log(`  ${bill.billId}: ${bill.description?.substring(0, 50)}...`);
  });

  console.log('\nMigration verification complete!');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
