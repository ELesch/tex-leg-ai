/**
 * Data Migration Script
 *
 * Migrates existing bill data from CSV and chat history from JSON files
 * to the PostgreSQL database.
 *
 * Usage: npx tsx scripts/migrate-data.ts
 */

import { PrismaClient, BillType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Configuration - adjust paths as needed
const CONFIG = {
  csvPath: process.env.BILLS_CSV_PATH || '../bill_descriptions.csv',
  textDir: process.env.BILLS_TEXT_DIR || '../texas_89R_bills_text',
  chatDir: process.env.CHAT_HISTORY_DIR || '../chat_history',
  sessionCode: '89R',
  sessionName: '89th Regular Session',
  batchSize: 100,
};

interface BillRecord {
  bill_id: string;
  filename: string;
  file_path: string;
  description: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

/**
 * Parse CSV file into records
 */
function parseCSV(content: string): BillRecord[] {
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));

  const records: BillRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle CSV with potential quoted fields
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    if (values.length >= 4) {
      records.push({
        bill_id: values[0],
        filename: values[1],
        file_path: values[2],
        description: values[3],
      });
    }
  }

  return records;
}

/**
 * Parse bill ID into type and number
 */
function parseBillId(billId: string): { type: BillType; number: number } | null {
  const match = billId.match(/^(HB|SB|HJR|SJR|HCR|SCR)\s*(\d+)$/i);
  if (!match) return null;

  return {
    type: match[1].toUpperCase() as BillType,
    number: parseInt(match[2], 10),
  };
}

/**
 * Read bill content from text file
 */
function readBillContent(filePath: string): string | null {
  try {
    // Try the original path
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }

    // Try relative to current directory
    const relativePath = path.join(process.cwd(), filePath);
    if (fs.existsSync(relativePath)) {
      return fs.readFileSync(relativePath, 'utf-8');
    }

    // Try relative to CONFIG.textDir
    const fileName = path.basename(filePath);
    const altPath = path.join(process.cwd(), CONFIG.textDir, '**', fileName);
    // For now, just return null if not found
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('='.repeat(60));
  console.log('TexLegAI Data Migration');
  console.log('='.repeat(60));

  // Step 1: Create or get legislature session
  console.log('\n[1/4] Creating legislature session...');
  const session = await prisma.legislatureSession.upsert({
    where: { code: CONFIG.sessionCode },
    update: {},
    create: {
      code: CONFIG.sessionCode,
      name: CONFIG.sessionName,
      startDate: new Date('2025-01-14'),
      isActive: true,
    },
  });
  console.log(`  Session: ${session.name} (${session.code})`);

  // Step 2: Read and parse CSV
  console.log('\n[2/4] Reading bill descriptions CSV...');
  const csvPath = path.resolve(process.cwd(), CONFIG.csvPath);

  if (!fs.existsSync(csvPath)) {
    console.error(`  ERROR: CSV file not found at ${csvPath}`);
    console.log('  Please set BILLS_CSV_PATH environment variable or place file at expected location');
    return;
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parseCSV(csvContent);
  console.log(`  Found ${records.length} bill records`);

  // Step 3: Migrate bills
  console.log('\n[3/4] Migrating bills to database...');
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < records.length; i += CONFIG.batchSize) {
    const batch = records.slice(i, i + CONFIG.batchSize);

    for (const record of batch) {
      try {
        const parsed = parseBillId(record.bill_id);
        if (!parsed) {
          console.warn(`  Skipping invalid bill ID: ${record.bill_id}`);
          skipped++;
          continue;
        }

        // Normalize bill ID (e.g., "HB 123")
        const normalizedBillId = `${parsed.type} ${parsed.number}`;

        // Read bill content
        const content = readBillContent(record.file_path);

        // Upsert bill
        await prisma.bill.upsert({
          where: { billId: normalizedBillId },
          update: {
            description: record.description,
            content,
            contentPath: record.file_path,
          },
          create: {
            sessionId: session.id,
            billType: parsed.type,
            billNumber: parsed.number,
            billId: normalizedBillId,
            filename: record.filename,
            description: record.description,
            content,
            contentPath: record.file_path,
            authors: [],
            subjects: [],
          },
        });

        migrated++;
      } catch (error) {
        console.error(`  Error migrating ${record.bill_id}:`, error);
        errors++;
      }
    }

    // Progress update
    const progress = Math.min(i + CONFIG.batchSize, records.length);
    process.stdout.write(`\r  Progress: ${progress}/${records.length} (${migrated} migrated, ${skipped} skipped, ${errors} errors)`);
  }

  console.log('\n  Migration complete!');
  console.log(`    - Migrated: ${migrated}`);
  console.log(`    - Skipped: ${skipped}`);
  console.log(`    - Errors: ${errors}`);

  // Step 4: Migrate chat history
  console.log('\n[4/4] Migrating chat history...');
  await migrateChatHistory(session.id);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Migration Complete!');
  console.log('='.repeat(60));

  const billCount = await prisma.bill.count();
  const chatCount = await prisma.chatSession.count();
  const messageCount = await prisma.chatMessage.count();

  console.log(`\nDatabase Summary:`);
  console.log(`  - Bills: ${billCount}`);
  console.log(`  - Chat Sessions: ${chatCount}`);
  console.log(`  - Chat Messages: ${messageCount}`);
}

/**
 * Migrate chat history from JSON files
 */
async function migrateChatHistory(sessionId: string) {
  const chatDir = path.resolve(process.cwd(), CONFIG.chatDir);

  if (!fs.existsSync(chatDir)) {
    console.log(`  Chat directory not found at ${chatDir}, skipping chat migration`);
    return;
  }

  const files = fs.readdirSync(chatDir).filter(f => f.endsWith('.json'));
  console.log(`  Found ${files.length} chat history files`);

  if (files.length === 0) return;

  // Create system user for migrated chats
  const systemUser = await prisma.user.upsert({
    where: { email: 'system@texlegai.local' },
    update: {},
    create: {
      email: 'system@texlegai.local',
      name: 'System (Migrated)',
      role: 'ADMIN',
    },
  });

  let migratedChats = 0;
  let migratedMessages = 0;

  for (const file of files) {
    try {
      // Extract bill ID from filename (e.g., "chat_hb1001.json" -> "HB 1001")
      const match = file.match(/chat_(hb|sb)(\d+)\.json/i);
      if (!match) {
        console.warn(`  Skipping unrecognized file: ${file}`);
        continue;
      }

      const billId = `${match[1].toUpperCase()} ${parseInt(match[2])}`;

      // Find the bill
      const bill = await prisma.bill.findUnique({
        where: { billId },
        select: { id: true },
      });

      if (!bill) {
        console.warn(`  Bill not found for chat: ${billId}`);
        continue;
      }

      // Read chat history
      const chatPath = path.join(chatDir, file);
      const chatContent = fs.readFileSync(chatPath, 'utf-8');
      const messages: ChatMessage[] = JSON.parse(chatContent);

      if (!Array.isArray(messages) || messages.length === 0) {
        continue;
      }

      // Create chat session
      const chatSession = await prisma.chatSession.create({
        data: {
          userId: systemUser.id,
          billId: bill.id,
          title: `Migrated chat for ${billId}`,
        },
      });

      // Create messages
      for (const msg of messages) {
        await prisma.chatMessage.create({
          data: {
            chatSessionId: chatSession.id,
            role: msg.role === 'user' ? 'USER' : 'ASSISTANT',
            content: msg.content,
            createdAt: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          },
        });
        migratedMessages++;
      }

      migratedChats++;
      console.log(`  Migrated chat for ${billId} (${messages.length} messages)`);
    } catch (error) {
      console.error(`  Error migrating ${file}:`, error);
    }
  }

  console.log(`  Chat migration complete: ${migratedChats} sessions, ${migratedMessages} messages`);
}

// Run migration
migrate()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
