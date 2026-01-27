/**
 * Diagnose FTP sync issues
 * Check why bills are being skipped
 */

import { Client } from 'basic-ftp';

const FTP_HOST = 'ftp.legis.state.tx.us';
const SESSION_CODE = '89R';

async function diagnose() {
  const client = new Client();
  client.ftp.verbose = true; // Enable verbose logging

  try {
    await client.access({ host: FTP_HOST, secure: false });
    console.log('Connected to FTP\n');

    // Check the base path structure
    console.log('=== Checking FTP Directory Structure ===\n');

    // List the session directory
    console.log('1. Listing /bills/89R/:');
    const sessionDir = await client.list('/bills/89R');
    sessionDir.forEach(item => console.log(`   ${item.isDirectory ? 'DIR' : 'FILE'}: ${item.name}`));

    // List billhistory
    console.log('\n2. Listing /bills/89R/billhistory/:');
    const historyDir = await client.list('/bills/89R/billhistory');
    historyDir.forEach(item => console.log(`   ${item.isDirectory ? 'DIR' : 'FILE'}: ${item.name}`));

    // List house_bills
    console.log('\n3. Listing /bills/89R/billhistory/house_bills/:');
    const houseDir = await client.list('/bills/89R/billhistory/house_bills');
    console.log(`   Found ${houseDir.length} directories`);
    houseDir.slice(0, 10).forEach(item => console.log(`   ${item.name}`));
    if (houseDir.length > 10) console.log('   ...');

    // List first directory's contents
    const firstDir = houseDir.find(d => d.isDirectory);
    if (firstDir) {
      console.log(`\n4. Listing /bills/89R/billhistory/house_bills/${firstDir.name}/:`);

      const billFiles = await client.list(`/bills/89R/billhistory/house_bills/${firstDir.name}`);
      console.log(`   Found ${billFiles.length} files`);
      billFiles.slice(0, 10).forEach(item => console.log(`   ${item.isDirectory ? 'DIR' : 'FILE'}: ${item.name}`));
    }

    // Try to fetch HB 1
    console.log('\n5. Attempting to fetch HB 1:');
    const hb1Path = '/bills/89R/billhistory/house_bills/HB00001_HB00099/HB 1.xml';
    console.log(`   Path: ${hb1Path}`);
    try {
      const chunks: Buffer[] = [];
      const writable = new (require('stream').Writable)({
        write(chunk: Buffer, enc: string, cb: () => void) { chunks.push(chunk); cb(); }
      });
      await client.downloadTo(writable, hb1Path);
      const content = Buffer.concat(chunks).toString('utf-8');
      console.log(`   SUCCESS: ${content.length} bytes`);
      console.log(`   First 200 chars: ${content.substring(0, 200)}...`);
    } catch (err: any) {
      console.log(`   FAILED: ${err.message}`);
    }

    // Try HB 100 (different directory)
    console.log('\n6. Attempting to fetch HB 100:');
    const hb100Path = '/bills/89R/billhistory/house_bills/HB00100_HB00198/HB 100.xml';
    console.log(`   Path: ${hb100Path}`);
    try {
      const chunks: Buffer[] = [];
      const writable = new (require('stream').Writable)({
        write(chunk: Buffer, enc: string, cb: () => void) { chunks.push(chunk); cb(); }
      });
      await client.downloadTo(writable, hb100Path);
      const content = Buffer.concat(chunks).toString('utf-8');
      console.log(`   SUCCESS: ${content.length} bytes`);
    } catch (err: any) {
      console.log(`   FAILED: ${err.message} (code: ${err.code})`);
    }

    // List the HB00100 directory to see what's there
    console.log('\n7. Listing HB00100_HB00198 directory:');
    try {
      const dir100 = await client.list('/bills/89R/billhistory/house_bills/HB00100_HB00198');
      console.log(`   Found ${dir100.length} files`);
      dir100.slice(0, 10).forEach(item => console.log(`   ${item.name}`));
    } catch (err: any) {
      console.log(`   FAILED: ${err.message}`);
    }

    // Check the actual directory naming pattern
    console.log('\n8. All house_bills directories:');
    for (const dir of houseDir) {
      if (dir.isDirectory) {
        try {
          const files = await client.list(`/bills/89R/billhistory/house_bills/${dir.name}`);
          const xmlCount = files.filter(f => f.name.endsWith('.xml')).length;
          console.log(`   ${dir.name}: ${xmlCount} XML files`);
        } catch {
          console.log(`   ${dir.name}: ERROR listing`);
        }
      }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.close();
  }
}

diagnose();
