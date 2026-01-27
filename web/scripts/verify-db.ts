import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function verify() {
  const bills = await prisma.bill.findMany({
    where: { session: { code: '89R' } },
    select: {
      billId: true,
      billType: true,
      billNumber: true,
      description: true,
      status: true,
      authors: true,
      content: true,
      lastAction: true,
      subjects: true,
    },
    orderBy: [{ billType: 'asc' }, { billNumber: 'asc' }],
  });

  console.log('═'.repeat(60));
  console.log('DATABASE VERIFICATION');
  console.log('═'.repeat(60));
  console.log(`Total bills: ${bills.length}`);

  // Count by type
  const hb = bills.filter(b => b.billType === 'HB');
  const sb = bills.filter(b => b.billType === 'SB');
  console.log(`HB bills: ${hb.length}`);
  console.log(`SB bills: ${sb.length}`);

  // Count with content
  const withContent = bills.filter(b => b.content && b.content.length > 0);
  console.log(`Bills with content: ${withContent.length}`);

  // Count with authors
  const withAuthors = bills.filter(b => b.authors && b.authors.length > 0);
  console.log(`Bills with authors: ${withAuthors.length}`);

  // Count with subjects
  const withSubjects = bills.filter(b => b.subjects && b.subjects.length > 0);
  console.log(`Bills with subjects: ${withSubjects.length}`);

  // Status breakdown
  const statuses: Record<string, number> = {};
  bills.forEach(b => { statuses[b.status] = (statuses[b.status] || 0) + 1; });
  console.log('\nStatus breakdown:');
  Object.entries(statuses).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => {
    console.log(`  ${s}: ${c}`);
  });

  // Sample bills
  console.log('\nSample HB bills:');
  for (const bill of hb.slice(0, 3)) {
    console.log(`\n  ${bill.billId}:`);
    console.log(`    Status: ${bill.status}`);
    console.log(`    Authors: ${(bill.authors || []).join(', ')}`);
    console.log(`    Description: ${(bill.description || '').substring(0, 60)}...`);
    console.log(`    Last Action: ${(bill.lastAction || '').substring(0, 50)}...`);
    console.log(`    Subjects: ${(bill.subjects || []).length} topics`);
    console.log(`    Content: ${bill.content ? bill.content.length + ' chars' : 'none'}`);
  }

  console.log('\nSample SB bills:');
  for (const bill of sb.slice(0, 3)) {
    console.log(`\n  ${bill.billId}:`);
    console.log(`    Status: ${bill.status}`);
    console.log(`    Authors: ${(bill.authors || []).join(', ')}`);
    console.log(`    Description: ${(bill.description || '').substring(0, 60)}...`);
    console.log(`    Content: ${bill.content ? bill.content.length + ' chars' : 'none'}`);
  }

  await prisma.$disconnect();
}

verify().catch(console.error);
