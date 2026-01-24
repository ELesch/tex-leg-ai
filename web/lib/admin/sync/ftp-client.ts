/**
 * FTP client utilities for fetching bill data from Texas Legislature FTP server
 *
 * FTP Server: ftp.legis.state.tx.us
 * Directory structure:
 *   billhistory/house_bills/HB00001_HB00099/HB 1.xml
 *   billhistory/senate_bills/SB00001_SB00099/SB 1.xml
 *   billtext/html/house_bills/HB00001_HB00099/HB00001I.HTM
 */

import { Client } from 'basic-ftp';
import { Writable } from 'stream';
import { logger } from '@/lib/logger';

const FTP_HOST = 'ftp.legis.state.tx.us';

// Shared FTP client for connection reuse
let sharedClient: Client | null = null;
let clientLastUsed: number = 0;
const CLIENT_TIMEOUT_MS = 60000; // Close idle connections after 60 seconds

/**
 * Get or create a shared FTP client for connection reuse
 */
async function getSharedClient(): Promise<Client> {
  const now = Date.now();

  // If we have a client and it's been used recently, try to reuse it
  if (sharedClient && (now - clientLastUsed) < CLIENT_TIMEOUT_MS) {
    clientLastUsed = now;
    return sharedClient;
  }

  // Close old client if it exists
  if (sharedClient) {
    try {
      sharedClient.close();
    } catch {
      // Ignore close errors
    }
  }

  // Create new client
  sharedClient = new Client();
  sharedClient.ftp.verbose = false;

  await sharedClient.access({
    host: FTP_HOST,
    secure: false,
  });

  clientLastUsed = now;
  return sharedClient;
}

/**
 * Close the shared FTP client (call when done syncing)
 */
export function closeSharedClient(): void {
  if (sharedClient) {
    try {
      sharedClient.close();
    } catch {
      // Ignore close errors
    }
    sharedClient = null;
  }
}

export interface DirectoryRange {
  start: number;
  end: number;
  dirname: string;
}

/**
 * Get the directory name for a given bill type and number
 * e.g., HB 1 -> "HB00001_HB00099", HB 150 -> "HB00100_HB00199"
 *
 * Directory structure on FTP:
 * - First directory: 1-99 (99 bills)
 * - Subsequent directories: 100-199, 200-299, etc. (100 bills each)
 */
export function getDirectoryRange(billType: string, billNumber: number): DirectoryRange {
  let rangeStart: number;
  let rangeEnd: number;

  if (billNumber <= 99) {
    rangeStart = 1;
    rangeEnd = 99;
  } else {
    // For 100+, directories are in 100-bill chunks: 100-199, 200-299, etc.
    rangeStart = Math.floor((billNumber - 100) / 100) * 100 + 100;
    rangeEnd = rangeStart + 99;
  }

  const paddedStart = rangeStart.toString().padStart(5, '0');
  const paddedEnd = rangeEnd.toString().padStart(5, '0');
  return {
    start: rangeStart,
    end: rangeEnd,
    dirname: `${billType}${paddedStart}_${billType}${paddedEnd}`,
  };
}

/**
 * Get the bill folder path based on bill type
 */
function getBillTypePath(billType: string): string {
  const bt = billType.toUpperCase();
  if (bt === 'HB' || bt === 'HJR' || bt === 'HCR') {
    return 'house_bills';
  }
  return 'senate_bills';
}

/**
 * Helper class to collect stream data into a string
 */
class StringWritable extends Writable {
  private chunks: Buffer[] = [];

  _write(chunk: Buffer, encoding: string, callback: (error?: Error | null) => void): void {
    this.chunks.push(chunk);
    callback();
  }

  toString(): string {
    return Buffer.concat(this.chunks).toString('utf-8');
  }
}

/**
 * Create and connect an FTP client
 */
async function createFtpClient(): Promise<Client> {
  const client = new Client();
  client.ftp.verbose = false;

  await client.access({
    host: FTP_HOST,
    secure: false,
  });

  return client;
}

export interface FetchBillResult {
  xml: string | null;
  notFound: boolean;  // true if bill doesn't exist (not an error)
  error: boolean;     // true if there was an actual error
}

/**
 * Fetch bill XML content from FTP server
 * Returns result indicating success, not found, or error
 */
export async function fetchBillXml(
  sessionCode: string,
  billType: string,
  billNumber: number
): Promise<FetchBillResult> {
  try {
    const client = await getSharedClient();

    const range = getDirectoryRange(billType, billNumber);
    const billTypePath = getBillTypePath(billType);
    const filename = `${billType} ${billNumber}.xml`;
    const remotePath = `/bills/${sessionCode}/billhistory/${billTypePath}/${range.dirname}/${filename}`;

    const writable = new StringWritable();

    try {
      await client.downloadTo(writable, remotePath);
      const xml = writable.toString();

      // Verify it's actually XML
      if (!xml.includes('<?xml') && !xml.includes('<billhistory') && !xml.includes('<BillHistory')) {
        logger.error('Invalid XML response', { billType, billNumber });
        return { xml: null, notFound: false, error: true };
      }

      return { xml, notFound: false, error: false };
    } catch (err: unknown) {
      // File not found is expected for non-existent bills
      const error = err as { code?: number };
      if (error.code === 550) {
        return { xml: null, notFound: true, error: false }; // File not found - not an error
      }
      throw err;
    }
  } catch (error) {
    logger.error('Error fetching bill XML from FTP', {
      billType,
      billNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Reset shared client on error so next request creates a fresh connection
    closeSharedClient();
    return { xml: null, notFound: false, error: true };
  }
}

/**
 * List all directory ranges for a bill type
 * e.g., ["HB00001_HB00099", "HB00100_HB00199", ...]
 */
export async function listBillDirectories(
  sessionCode: string,
  billType: string
): Promise<string[]> {
  try {
    const client = await getSharedClient();

    const billTypePath = getBillTypePath(billType);
    const remotePath = `/bills/${sessionCode}/billhistory/${billTypePath}`;

    const list = await client.list(remotePath);

    // Filter to directories matching the pattern HB00001_HB00099
    const pattern = new RegExp(`^${billType}\\d{5}_${billType}\\d{5}$`);
    const dirs = list
      .filter(item => item.isDirectory && pattern.test(item.name))
      .map(item => item.name)
      .sort();

    return dirs;
  } catch (error) {
    logger.error('Error listing FTP directories', {
      billType,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    closeSharedClient();
    return [];
  }
}

/**
 * List all XML files in a specific directory range
 * Returns filenames like ["HB 1.xml", "HB 2.xml", ...]
 */
export async function listBillFiles(
  sessionCode: string,
  billType: string,
  dirRange: string
): Promise<string[]> {
  try {
    const client = await getSharedClient();

    const billTypePath = getBillTypePath(billType);
    const remotePath = `/bills/${sessionCode}/billhistory/${billTypePath}/${dirRange}`;

    const list = await client.list(remotePath);

    // Filter to XML files
    const files = list
      .filter(item => !item.isDirectory && item.name.endsWith('.xml'))
      .map(item => item.name)
      .sort((a, b) => {
        // Sort by bill number
        const numA = parseInt(a.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.match(/\d+/)?.[0] || '0');
        return numA - numB;
      });

    return files;
  } catch (error) {
    logger.error('Error listing FTP files', {
      dirRange,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    closeSharedClient();
    return [];
  }
}

/**
 * Scan all available bills for a bill type and return their bill numbers
 * This is useful for knowing exactly which bills exist before syncing
 */
export async function scanAvailableBills(
  sessionCode: string,
  billType: string
): Promise<number[]> {
  const billNumbers: number[] = [];

  try {
    const client = await getSharedClient();

    const billTypePath = getBillTypePath(billType);
    const basePath = `/bills/${sessionCode}/billhistory/${billTypePath}`;

    // Get all directory ranges
    const dirList = await client.list(basePath);
    const pattern = new RegExp(`^${billType}\\d{5}_${billType}\\d{5}$`);
    const directories = dirList
      .filter(item => item.isDirectory && pattern.test(item.name))
      .map(item => item.name)
      .sort();

    // Get files from each directory
    for (const dir of directories) {
      try {
        const fileList = await client.list(`${basePath}/${dir}`);

        for (const file of fileList) {
          if (!file.isDirectory && file.name.endsWith('.xml')) {
            const match = file.name.match(/\d+/);
            if (match) {
              billNumbers.push(parseInt(match[0]));
            }
          }
        }
      } catch (err) {
        logger.error('Error listing FTP directory files', {
          dir,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return billNumbers.sort((a, b) => a - b);
  } catch (error) {
    logger.error('Error scanning bills on FTP', {
      billType,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    closeSharedClient();
    return [];
  }
}

/**
 * Fetch bill text HTML from the URL specified in the XML
 * Returns cleaned text content or null if not available
 */
export async function fetchBillTextFromUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TexLegAI Bill Sync Bot (educational/research)',
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Check if it's an error page
    if (html.includes('Website Error') || html.includes('Page Not Found')) {
      return null;
    }

    // Extract text content from HTML
    const text = html
      // Remove script and style tags and their content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Convert <br> and block elements to newlines
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
      // Remove remaining HTML tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&#xA0;/gi, ' ')
      .replace(/&#160;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#38;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&#60;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#62;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&mdash;/g, '—')
      .replace(/&#8212;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&#8211;/g, '–')
      .replace(/&hellip;/g, '...')
      .replace(/&#8230;/g, '...')
      .replace(/&ldquo;/g, '"')
      .replace(/&#8220;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&#8221;/g, '"')
      .replace(/&lsquo;/g, "'")
      .replace(/&#8216;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&#8217;/g, "'")
      .replace(/&sect;/g, '§')
      .replace(/&#167;/g, '§')
      .replace(/&para;/g, '¶')
      .replace(/&#182;/g, '¶')
      .replace(/&deg;/g, '°')
      .replace(/&#176;/g, '°')
      .replace(/&cent;/g, '¢')
      .replace(/&#162;/g, '¢')
      .replace(/&copy;/g, '©')
      .replace(/&#169;/g, '©')
      .replace(/&reg;/g, '®')
      .replace(/&frac12;/g, '½')
      .replace(/&frac14;/g, '¼')
      .replace(/&frac34;/g, '¾')
      .replace(/&bull;/g, '•')
      .replace(/&middot;/g, '·')
      // Generic numeric entity decoder
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
      .replace(/&#x([0-9a-fA-F]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
      // Clean up whitespace
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n +/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (text.length > 100) {
      return text.substring(0, 50000); // Limit to 50KB
    }

    return null;
  } catch (error) {
    logger.error('Error fetching bill text from URL', {
      url,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}
