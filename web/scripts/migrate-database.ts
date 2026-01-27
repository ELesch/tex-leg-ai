/**
 * Database Migration Script
 * Migrates all data from source Supabase database to destination
 */

import { PrismaClient } from '@prisma/client';

// Source database (current)
const SOURCE_URL = "postgresql://postgres.ccmgihnjofdgbwqdprsd:FYNn%40qWiva%40FMm2CFN8h@aws-0-us-west-2.pooler.supabase.com:5432/postgres";

// Destination database (new)
const DEST_URL = "postgresql://postgres.euzefzltzqubzueqldqq:KmzRgvoeKyiON7ge@aws-1-us-east-2.pooler.supabase.com:5432/postgres";

// Create clients for both databases
const sourceDb = new PrismaClient({
  datasources: { db: { url: SOURCE_URL } },
});

const destDb = new PrismaClient({
  datasources: { db: { url: DEST_URL } },
});

async function migrateTable<T>(
  tableName: string,
  readFn: () => Promise<T[]>,
  writeFn: (data: T[]) => Promise<void>
): Promise<number> {
  console.log(`\nMigrating ${tableName}...`);
  const data = await readFn();
  console.log(`  Found ${data.length} records`);

  if (data.length > 0) {
    await writeFn(data);
    console.log(`  Migrated ${data.length} records`);
  }

  return data.length;
}

async function main() {
  console.log('Starting database migration...\n');
  console.log('Source: aws-0-us-west-2 (ccmgihnjofdgbwqdprsd)');
  console.log('Destination: aws-1-us-east-2 (euzefzltzqubzueqldqq)\n');

  let totalRecords = 0;

  try {
    // Test connections
    console.log('Testing connections...');
    await sourceDb.$connect();
    console.log('  Source: Connected');
    await destDb.$connect();
    console.log('  Destination: Connected\n');

    // ============================================
    // Phase 1: Independent tables (no foreign keys)
    // ============================================
    console.log('=== Phase 1: Independent tables ===');

    // Users
    totalRecords += await migrateTable(
      'User',
      () => sourceDb.user.findMany(),
      (data) => destDb.user.createMany({ data, skipDuplicates: true })
    );

    // LegislatureSession
    totalRecords += await migrateTable(
      'LegislatureSession',
      () => sourceDb.legislatureSession.findMany(),
      (data) => destDb.legislatureSession.createMany({ data, skipDuplicates: true })
    );

    // VerificationToken
    totalRecords += await migrateTable(
      'VerificationToken',
      () => sourceDb.verificationToken.findMany(),
      (data) => destDb.verificationToken.createMany({ data, skipDuplicates: true })
    );

    // Team
    totalRecords += await migrateTable(
      'Team',
      () => sourceDb.team.findMany(),
      (data) => destDb.team.createMany({ data, skipDuplicates: true })
    );

    // Author
    totalRecords += await migrateTable(
      'Author',
      () => sourceDb.author.findMany(),
      (data) => destDb.author.createMany({ data, skipDuplicates: true })
    );

    // SyncJob
    totalRecords += await migrateTable(
      'SyncJob',
      () => sourceDb.syncJob.findMany(),
      (data) => destDb.syncJob.createMany({ data, skipDuplicates: true })
    );

    // ============================================
    // Phase 2: Depends on User
    // ============================================
    console.log('\n=== Phase 2: User-dependent tables ===');

    // Account
    totalRecords += await migrateTable(
      'Account',
      () => sourceDb.account.findMany(),
      (data) => destDb.account.createMany({ data, skipDuplicates: true })
    );

    // Session
    totalRecords += await migrateTable(
      'Session',
      () => sourceDb.session.findMany(),
      (data) => destDb.session.createMany({ data, skipDuplicates: true })
    );

    // AdminSetting
    totalRecords += await migrateTable(
      'AdminSetting',
      () => sourceDb.adminSetting.findMany(),
      (data) => destDb.adminSetting.createMany({ data, skipDuplicates: true })
    );

    // Contact
    totalRecords += await migrateTable(
      'Contact',
      () => sourceDb.contact.findMany(),
      (data) => destDb.contact.createMany({ data, skipDuplicates: true })
    );

    // UserContact
    totalRecords += await migrateTable(
      'UserContact',
      () => sourceDb.userContact.findMany(),
      (data) => destDb.userContact.createMany({ data, skipDuplicates: true })
    );

    // PushSubscription
    totalRecords += await migrateTable(
      'PushSubscription',
      () => sourceDb.pushSubscription.findMany(),
      (data) => destDb.pushSubscription.createMany({ data, skipDuplicates: true })
    );

    // NotificationPreference
    totalRecords += await migrateTable(
      'NotificationPreference',
      () => sourceDb.notificationPreference.findMany(),
      (data) => destDb.notificationPreference.createMany({ data, skipDuplicates: true })
    );

    // ============================================
    // Phase 3: Depends on LegislatureSession
    // ============================================
    console.log('\n=== Phase 3: Bill table ===');

    // Bills - may be large, batch if needed
    const bills = await sourceDb.bill.findMany();
    console.log(`\nMigrating Bill... Found ${bills.length} records`);

    if (bills.length > 0) {
      // Batch insert for large datasets
      const BATCH_SIZE = 500;
      for (let i = 0; i < bills.length; i += BATCH_SIZE) {
        const batch = bills.slice(i, i + BATCH_SIZE);
        await destDb.bill.createMany({ data: batch, skipDuplicates: true });
        console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} records`);
      }
      totalRecords += bills.length;
      console.log(`  Migrated ${bills.length} total Bill records`);
    }

    // ============================================
    // Phase 4: Depends on Bill and User
    // ============================================
    console.log('\n=== Phase 4: Bill-dependent tables ===');

    // ChatSession
    totalRecords += await migrateTable(
      'ChatSession',
      () => sourceDb.chatSession.findMany(),
      (data) => destDb.chatSession.createMany({ data, skipDuplicates: true })
    );

    // FollowedBill
    totalRecords += await migrateTable(
      'FollowedBill',
      () => sourceDb.followedBill.findMany(),
      (data) => destDb.followedBill.createMany({ data, skipDuplicates: true })
    );

    // BillArticle
    totalRecords += await migrateTable(
      'BillArticle',
      () => sourceDb.billArticle.findMany(),
      (data) => destDb.billArticle.createMany({ data, skipDuplicates: true })
    );

    // BillCodeReference
    totalRecords += await migrateTable(
      'BillCodeReference',
      () => sourceDb.billCodeReference.findMany(),
      (data) => destDb.billCodeReference.createMany({ data, skipDuplicates: true })
    );

    // TerminologyReplacement
    totalRecords += await migrateTable(
      'TerminologyReplacement',
      () => sourceDb.terminologyReplacement.findMany(),
      (data) => destDb.terminologyReplacement.createMany({ data, skipDuplicates: true })
    );

    // PersonalAnnotation
    totalRecords += await migrateTable(
      'PersonalAnnotation',
      () => sourceDb.personalAnnotation.findMany(),
      (data) => destDb.personalAnnotation.createMany({ data, skipDuplicates: true })
    );

    // PersonalNote
    totalRecords += await migrateTable(
      'PersonalNote',
      () => sourceDb.personalNote.findMany(),
      (data) => destDb.personalNote.createMany({ data, skipDuplicates: true })
    );

    // ============================================
    // Phase 5: Depends on ChatSession
    // ============================================
    console.log('\n=== Phase 5: Chat messages ===');

    // ChatMessage
    totalRecords += await migrateTable(
      'ChatMessage',
      () => sourceDb.chatMessage.findMany(),
      (data) => destDb.chatMessage.createMany({ data, skipDuplicates: true })
    );

    // ============================================
    // Phase 6: Depends on Team
    // ============================================
    console.log('\n=== Phase 6: Team-dependent tables ===');

    // TeamMembership
    totalRecords += await migrateTable(
      'TeamMembership',
      () => sourceDb.teamMembership.findMany(),
      (data) => destDb.teamMembership.createMany({ data, skipDuplicates: true })
    );

    // TeamInvitation
    totalRecords += await migrateTable(
      'TeamInvitation',
      () => sourceDb.teamInvitation.findMany(),
      (data) => destDb.teamInvitation.createMany({ data, skipDuplicates: true })
    );

    // TeamActivity
    totalRecords += await migrateTable(
      'TeamActivity',
      () => sourceDb.teamActivity.findMany(),
      (data) => destDb.teamActivity.createMany({ data, skipDuplicates: true })
    );

    // TeamWorkspace (depends on Team and Bill)
    totalRecords += await migrateTable(
      'TeamWorkspace',
      () => sourceDb.teamWorkspace.findMany(),
      (data) => destDb.teamWorkspace.createMany({ data, skipDuplicates: true })
    );

    // SharedContact
    totalRecords += await migrateTable(
      'SharedContact',
      () => sourceDb.sharedContact.findMany(),
      (data) => destDb.sharedContact.createMany({ data, skipDuplicates: true })
    );

    // ============================================
    // Phase 7: Depends on TeamWorkspace
    // ============================================
    console.log('\n=== Phase 7: Workspace-dependent tables ===');

    // BillAnnotation
    totalRecords += await migrateTable(
      'BillAnnotation',
      () => sourceDb.billAnnotation.findMany(),
      (data) => destDb.billAnnotation.createMany({ data, skipDuplicates: true })
    );

    // WorkspaceComment
    totalRecords += await migrateTable(
      'WorkspaceComment',
      () => sourceDb.workspaceComment.findMany(),
      (data) => destDb.workspaceComment.createMany({ data, skipDuplicates: true })
    );

    // TeamChatSession
    totalRecords += await migrateTable(
      'TeamChatSession',
      () => sourceDb.teamChatSession.findMany(),
      (data) => destDb.teamChatSession.createMany({ data, skipDuplicates: true })
    );

    // ============================================
    // Phase 8: Depends on TeamChatSession
    // ============================================
    console.log('\n=== Phase 8: Team chat messages ===');

    // TeamChatMessage
    totalRecords += await migrateTable(
      'TeamChatMessage',
      () => sourceDb.teamChatMessage.findMany(),
      (data) => destDb.teamChatMessage.createMany({ data, skipDuplicates: true })
    );

    // ============================================
    // Phase 9: Contact-related tables
    // ============================================
    console.log('\n=== Phase 9: Contact-related tables ===');

    // StaffPosition
    totalRecords += await migrateTable(
      'StaffPosition',
      () => sourceDb.staffPosition.findMany(),
      (data) => destDb.staffPosition.createMany({ data, skipDuplicates: true })
    );

    // ContactNote
    totalRecords += await migrateTable(
      'ContactNote',
      () => sourceDb.contactNote.findMany(),
      (data) => destDb.contactNote.createMany({ data, skipDuplicates: true })
    );

    // ============================================
    // Phase 10: Notification tables
    // ============================================
    console.log('\n=== Phase 10: Notification tables ===');

    // BillNotification (depends on FollowedBill)
    totalRecords += await migrateTable(
      'BillNotification',
      () => sourceDb.billNotification.findMany(),
      (data) => destDb.billNotification.createMany({ data, skipDuplicates: true })
    );

    // ============================================
    // Summary
    // ============================================
    console.log('\n========================================');
    console.log(`Migration complete! Total records: ${totalRecords}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('\nMigration error:', error);
    throw error;
  } finally {
    await sourceDb.$disconnect();
    await destDb.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
