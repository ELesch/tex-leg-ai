import { Client } from 'basic-ftp';

async function check() {
  const client = new Client();
  await client.access({ host: 'ftp.legis.state.tx.us', secure: false });

  console.log('=== billtext directory ===');
  const billtext = await client.list('/bills/89R/billtext');
  billtext.forEach(d => console.log('  ' + d.name + (d.isDirectory ? '/' : '')));

  console.log('\n=== billtext/html/house_bills ===');
  const htmlDir = await client.list('/bills/89R/billtext/html/house_bills');
  console.log(`  ${htmlDir.length} directories`);
  htmlDir.slice(0, 5).forEach(d => console.log('  ' + d.name));

  console.log('\n=== Sample files in HB00001_HB00099 ===');
  const hb1Dir = await client.list('/bills/89R/billtext/html/house_bills/HB00001_HB00099');
  console.log(`  ${hb1Dir.length} files`);
  hb1Dir.slice(0, 15).forEach(f => console.log('  ' + f.name));

  console.log('\n=== billtext/doc/house_bills (what Python uses) ===');
  try {
    const docDir = await client.list('/bills/89R/billtext/doc/house_bills');
    console.log(`  ${docDir.length} directories`);
    docDir.slice(0, 5).forEach(d => console.log('  ' + d.name));

    const docFiles = await client.list('/bills/89R/billtext/doc/house_bills/HB00001_HB00099');
    console.log(`\n  Sample doc files: ${docFiles.length}`);
    docFiles.slice(0, 10).forEach(f => console.log('  ' + f.name));
  } catch (e) {
    console.log('  ERROR: ' + (e as Error).message);
  }

  client.close();
}

check().catch(console.error);
