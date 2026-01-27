/**
 * Test script to verify FTP bill sync functionality
 * Run with: npx tsx scripts/test-ftp-sync.ts
 */

import { Client } from 'basic-ftp';
import { parseBillXml, ParsedBill } from '../lib/admin/sync/xml-parser';
import { PrismaClient, BillType } from '@prisma/client';
import { fetchBillTextFromUrl } from '../lib/admin/sync/ftp-client';

const FTP_HOST = 'ftp.legis.state.tx.us';
const SESSION_CODE = '89R';
const prisma = new PrismaClient();

interface TestResult {
  billId: string;
  success: boolean;
  error?: string;
  xmlLength?: number;
  hasValidXml?: boolean;
  parsed?: ParsedBill | null;
  parseError?: string;
}

class FtpTester {
  private client: Client | null = null;
  public results: TestResult[] = [];
  private errors: TestResult[] = [];
  private notFound: string[] = [];
  private successful: number = 0;

  async connect(): Promise<void> {
    this.client = new Client();
    this.client.ftp.verbose = false;
    await this.client.access({
      host: FTP_HOST,
      secure: false,
    });
    console.log('Connected to FTP server');
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }

  getDirectoryRange(billType: string, billNumber: number): string {
    const rangeStart = Math.floor((billNumber - 1) / 99) * 99 + 1;
    const rangeEnd = rangeStart + 98;
    const paddedStart = rangeStart.toString().padStart(5, '0');
    const paddedEnd = rangeEnd.toString().padStart(5, '0');
    return `${billType}${paddedStart}_${billType}${paddedEnd}`;
  }

  async fetchBillXml(billType: string, billNumber: number): Promise<TestResult> {
    const billId = `${billType} ${billNumber}`;

    if (!this.client) {
      return { billId, success: false, error: 'Not connected' };
    }

    try {
      const range = this.getDirectoryRange(billType, billNumber);
      const billTypePath = billType === 'HB' ? 'house_bills' : 'senate_bills';
      const filename = `${billType} ${billNumber}.xml`;
      const remotePath = `/bills/${SESSION_CODE}/billhistory/${billTypePath}/${range}/${filename}`;

      // Use a writable stream to collect data
      const chunks: Buffer[] = [];
      const writable = new (require('stream').Writable)({
        write(chunk: Buffer, encoding: string, callback: () => void) {
          chunks.push(chunk);
          callback();
        }
      });

      await this.client.downloadTo(writable, remotePath);
      const xml = Buffer.concat(chunks).toString('utf-8');

      // Validate XML content
      const hasValidXml = xml.includes('<?xml') || xml.includes('<BillHistory') || xml.includes('<billhistory');

      // Try to parse the XML
      let parsed: ParsedBill | null = null;
      let parseError: string | undefined;
      try {
        parsed = parseBillXml(xml, billType as 'HB' | 'SB', billNumber);
      } catch (err: unknown) {
        parseError = err instanceof Error ? err.message : 'Parse error';
      }

      return {
        billId,
        success: true,
        xmlLength: xml.length,
        hasValidXml,
        parsed,
        parseError,
      };
    } catch (err: unknown) {
      const error = err as { code?: number; message?: string };

      // 550 = File not found (expected for non-existent bills)
      if (error.code === 550) {
        return { billId, success: true, error: 'not_found' };
      }

      return {
        billId,
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  async runTest(billType: string, startBill: number, endBill: number): Promise<void> {
    console.log(`\nTesting ${billType} ${startBill} to ${endBill}...`);
    console.log('─'.repeat(50));

    for (let i = startBill; i <= endBill; i++) {
      const result = await this.fetchBillXml(billType, i);
      this.results.push(result);

      if (result.error === 'not_found') {
        this.notFound.push(result.billId);
        process.stdout.write('.');
      } else if (result.success) {
        this.successful++;
        process.stdout.write('✓');
      } else {
        this.errors.push(result);
        process.stdout.write('✗');
      }

      // Print newline every 50 bills for readability
      if ((i - startBill + 1) % 50 === 0) {
        console.log(` [${i}]`);
      }
    }
    console.log();
  }

  validateParsedBill(parsed: ParsedBill): string[] {
    const issues: string[] = [];

    // Required fields for database
    if (!parsed.billId) issues.push('missing billId');
    if (!parsed.billType) issues.push('missing billType');
    if (parsed.billNumber === undefined) issues.push('missing billNumber');
    if (!parsed.description) issues.push('missing description');
    if (!parsed.status) issues.push('missing status');
    if (!parsed.lastAction) issues.push('missing lastAction');

    // Arrays should exist (can be empty)
    if (!Array.isArray(parsed.authors)) issues.push('authors not an array');
    if (!Array.isArray(parsed.coauthors)) issues.push('coauthors not an array');
    if (!Array.isArray(parsed.sponsors)) issues.push('sponsors not an array');
    if (!Array.isArray(parsed.cosponsors)) issues.push('cosponsors not an array');
    if (!Array.isArray(parsed.subjects)) issues.push('subjects not an array');
    if (!Array.isArray(parsed.committees)) issues.push('committees not an array');
    if (!Array.isArray(parsed.actions)) issues.push('actions not an array');

    // Validate authors exist for most bills
    if (parsed.authors?.length === 0) issues.push('no authors');

    // Validate dates are Date objects or null
    if (parsed.lastActionDate !== null && !(parsed.lastActionDate instanceof Date)) {
      issues.push('lastActionDate not a Date');
    }
    if (parsed.lastUpdate !== null && !(parsed.lastUpdate instanceof Date)) {
      issues.push('lastUpdate not a Date');
    }

    return issues;
  }

  printSummary(): void {
    // Calculate parse statistics
    const successfulResults = this.results.filter(r => r.success && !r.error);
    const parsedOk = successfulResults.filter(r => r.parsed !== null && !r.parseError);
    const parseFailed = successfulResults.filter(r => r.parsed === null || r.parseError);

    // Validate each parsed bill for database readiness
    const validationIssues: { billId: string; issues: string[] }[] = [];
    for (const result of parsedOk) {
      const issues = this.validateParsedBill(result.parsed!);
      if (issues.length > 0) {
        validationIssues.push({ billId: result.billId, issues });
      }
    }
    const fullyValid = parsedOk.length - validationIssues.length;

    console.log('\n' + '═'.repeat(60));
    console.log('SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Total tested:       ${this.results.length}`);
    console.log(`FTP Successful:     ${this.successful}`);
    console.log(`FTP Not found:      ${this.notFound.length}`);
    console.log(`FTP Errors:         ${this.errors.length}`);
    console.log('─'.repeat(60));
    console.log(`XML Parsed OK:      ${parsedOk.length}`);
    console.log(`XML Parse Failed:   ${parseFailed.length}`);
    console.log('─'.repeat(60));
    console.log(`DB Ready (valid):   ${fullyValid}`);
    console.log(`Validation Issues:  ${validationIssues.length}`);

    if (this.errors.length > 0) {
      console.log('\nFTP ERRORS:');
      for (const err of this.errors) {
        console.log(`  ${err.billId}: ${err.error}`);
      }
    }

    if (parseFailed.length > 0) {
      console.log('\nPARSE FAILURES:');
      for (const result of parseFailed.slice(0, 10)) {
        console.log(`  ${result.billId}: ${result.parseError || 'returned null'}`);
      }
      if (parseFailed.length > 10) {
        console.log(`  ... and ${parseFailed.length - 10} more`);
      }
    }

    if (validationIssues.length > 0) {
      console.log('\nVALIDATION ISSUES (would fail DB insert):');
      for (const { billId, issues } of validationIssues.slice(0, 15)) {
        console.log(`  ${billId}: ${issues.join(', ')}`);
      }
      if (validationIssues.length > 15) {
        console.log(`  ... and ${validationIssues.length - 15} more`);
      }
    }

    // Show some sample successful results with parsed data
    if (parsedOk.length > 0) {
      console.log('\nSAMPLE PARSED BILLS (full data):');
      for (const result of parsedOk.slice(0, 3)) {
        const p = result.parsed!;
        console.log(`\n  ${result.billId}:`);
        console.log(`    billType:       ${p.billType}`);
        console.log(`    billNumber:     ${p.billNumber}`);
        console.log(`    description:    ${p.description?.substring(0, 50)}...`);
        console.log(`    authors:        [${p.authors?.join(', ') || ''}]`);
        console.log(`    coauthors:      [${p.coauthors?.join(', ') || ''}]`);
        console.log(`    sponsors:       [${p.sponsors?.join(', ') || ''}]`);
        console.log(`    cosponsors:     [${p.cosponsors?.join(', ') || ''}]`);
        console.log(`    subjects:       [${p.subjects?.join(', ') || ''}]`);
        console.log(`    status:         ${p.status}`);
        console.log(`    lastAction:     ${p.lastAction?.substring(0, 40)}...`);
        console.log(`    lastActionDate: ${p.lastActionDate}`);
        console.log(`    lastUpdate:     ${p.lastUpdate}`);
        console.log(`    textUrl:        ${p.textUrl || 'none'}`);
        console.log(`    committees:     ${p.committees?.length || 0} entries`);
        console.log(`    actions:        ${p.actions?.length || 0} entries`);
      }
    }

    // Show distribution of not found
    if (this.notFound.length > 20) {
      console.log(`\nNOT FOUND: ${this.notFound.length} bills (expected - not all numbers exist)`);
    }
  }
}

async function testDatabaseInsertion(parsedBills: { billId: string; parsed: ParsedBill }[]) {
  console.log('\n' + '═'.repeat(60));
  console.log('DATABASE INSERTION TEST');
  console.log('═'.repeat(60));

  // Get or create session
  console.log('\nCreating/updating session...');
  const session = await prisma.legislatureSession.upsert({
    where: { code: SESSION_CODE },
    create: {
      code: SESSION_CODE,
      name: '89th Regular Session',
      startDate: new Date('2025-01-14'),
      isActive: true,
    },
    update: {
      name: '89th Regular Session',
      isActive: true,
    },
  });
  console.log(`  Session: ${session.code} (${session.id})`);

  // Test inserting first 10 bills
  const billsToTest = parsedBills.slice(0, 10);
  console.log(`\nTesting insertion of ${billsToTest.length} bills...`);

  let created = 0;
  let updated = 0;
  let errors = 0;
  const insertErrors: { billId: string; error: string }[] = [];

  for (const { billId, parsed } of billsToTest) {
    try {
      // Fetch bill text content
      let content: string | null = null;
      if (parsed.textUrl) {
        console.log(`  Fetching text for ${billId}...`);
        content = await fetchBillTextFromUrl(parsed.textUrl);
      }

      // Get committee info
      let committeeName: string | null = null;
      let committeeStatus: string | null = null;
      if (parsed.committees.length > 0) {
        const inCommittee = parsed.committees.find(c => c.status.toLowerCase().includes('in committee'));
        const committee = inCommittee || parsed.committees[0];
        committeeName = committee.name;
        committeeStatus = committee.status;
      }

      // Check if bill exists
      const existing = await prisma.bill.findUnique({
        where: { billId },
        select: { id: true },
      });

      if (existing) {
        // Update existing bill
        await prisma.bill.update({
          where: { billId },
          data: {
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
          },
        });
        updated++;
        console.log(`  ✓ ${billId}: updated`);
      } else {
        // Create new bill
        await prisma.bill.create({
          data: {
            sessionId: session.id,
            billType: parsed.billType as BillType,
            billNumber: parsed.billNumber,
            billId: parsed.billId,
            filename: `${parsed.billType.toLowerCase()}${parsed.billNumber}.txt`,
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
          },
        });
        created++;
        console.log(`  ✓ ${billId}: created`);
      }
    } catch (error) {
      errors++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      insertErrors.push({ billId, error: errorMsg });
      console.log(`  ✗ ${billId}: ${errorMsg}`);
    }
  }

  // Verify the bills are in the database
  console.log('\nVerifying inserted bills...');
  const verifyBillIds = billsToTest.map(b => b.billId);
  const dbBills = await prisma.bill.findMany({
    where: { billId: { in: verifyBillIds } },
    select: {
      billId: true,
      description: true,
      authors: true,
      status: true,
      content: true,
    },
  });

  console.log(`  Found ${dbBills.length}/${verifyBillIds.length} bills in database`);

  // Show sample from DB
  if (dbBills.length > 0) {
    console.log('\nSAMPLE FROM DATABASE:');
    for (const bill of dbBills.slice(0, 3)) {
      console.log(`\n  ${bill.billId}:`);
      console.log(`    description: ${bill.description?.substring(0, 50)}...`);
      console.log(`    authors:     [${bill.authors.join(', ')}]`);
      console.log(`    status:      ${bill.status}`);
      console.log(`    content:     ${bill.content ? `${bill.content.length} chars` : 'null'}`);
    }
  }

  // Summary
  console.log('\n' + '─'.repeat(60));
  console.log('DATABASE TEST SUMMARY:');
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Errors:  ${errors}`);

  if (insertErrors.length > 0) {
    console.log('\nINSERTION ERRORS:');
    for (const { billId, error } of insertErrors) {
      console.log(`  ${billId}: ${error}`);
    }
  }

  return { created, updated, errors };
}

async function main() {
  const tester = new FtpTester();

  try {
    await tester.connect();

    // Test first 50 HB bills (smaller set for DB test)
    await tester.runTest('HB', 1, 50);

    // Test first 20 SB bills
    await tester.runTest('SB', 1, 20);

    tester.printSummary();

    // Get successfully parsed bills for DB test
    const parsedBills = tester.results
      .filter(r => r.success && !r.error && r.parsed)
      .map(r => ({ billId: r.billId, parsed: r.parsed! }));

    // Test database insertion
    if (parsedBills.length > 0) {
      await testDatabaseInsertion(parsedBills);
    }

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await tester.disconnect();
    await prisma.$disconnect();
    console.log('\nDisconnected from FTP server and database');
  }
}

main();
