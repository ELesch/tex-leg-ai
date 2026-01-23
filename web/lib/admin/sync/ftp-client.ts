/**
 * FTP client utilities for fetching bill data from Texas Legislature FTP server
 *
 * FTP Server: ftp.legis.state.tx.us
 * Directory structure:
 *   billhistory/house_bills/HB00001_HB00099/HB 1.xml
 *   billhistory/senate_bills/SB00001_SB00099/SB 1.xml
 *   billtext/html/house_bills/HB00001_HB00099/HB00001I.HTM
 */

const FTP_BASE_URL = 'https://ftp.legis.state.tx.us';

export interface DirectoryRange {
  start: number;
  end: number;
  dirname: string;
}

/**
 * Get the directory name for a given bill type and number
 * e.g., HB 1 -> "HB00001_HB00099", HB 150 -> "HB00100_HB00199"
 */
export function getDirectoryRange(billType: string, billNumber: number): DirectoryRange {
  const rangeStart = Math.floor((billNumber - 1) / 99) * 99 + 1;
  const rangeEnd = rangeStart + 98;
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
 * Build the URL for a bill history XML file
 */
export function buildBillXmlUrl(sessionCode: string, billType: string, billNumber: number): string {
  const range = getDirectoryRange(billType, billNumber);
  const billTypePath = getBillTypePath(billType);
  // XML files use format "HB 1.xml" with a space
  const filename = `${billType} ${billNumber}.xml`;
  return `${FTP_BASE_URL}/bills/${sessionCode}/billhistory/${billTypePath}/${range.dirname}/${encodeURIComponent(filename)}`;
}

/**
 * Build the URL for a directory listing
 */
export function buildDirectoryListUrl(sessionCode: string, billType: string): string {
  const billTypePath = getBillTypePath(billType);
  return `${FTP_BASE_URL}/bills/${sessionCode}/billhistory/${billTypePath}/`;
}

/**
 * Fetch bill XML content from FTP server
 * Returns null if bill doesn't exist
 */
export async function fetchBillXml(
  sessionCode: string,
  billType: string,
  billNumber: number
): Promise<string | null> {
  const url = buildBillXmlUrl(sessionCode, billType, billNumber);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TxLegAI Bill Sync Bot (educational/research)',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Bill doesn't exist
      }
      console.error(`FTP fetch failed for ${billType} ${billNumber}: ${response.status}`);
      return null;
    }

    const xml = await response.text();

    // Verify it's actually XML (not an error page)
    if (!xml.includes('<?xml') && !xml.includes('<billhistory')) {
      console.error(`Invalid XML response for ${billType} ${billNumber}`);
      return null;
    }

    return xml;
  } catch (error) {
    console.error(`Error fetching ${billType} ${billNumber}:`, error);
    return null;
  }
}

/**
 * Parse directory listing HTML to extract subdirectory names
 * Returns an array of directory names like ["HB00001_HB00099", "HB00100_HB00199", ...]
 */
function parseDirectoryListing(html: string): string[] {
  const dirs: string[] = [];
  // Look for links to directories like HB00001_HB00099/
  const pattern = /href="([A-Z]{2,3}\d{5}_[A-Z]{2,3}\d{5})\/"/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    dirs.push(match[1]);
  }
  return dirs.sort();
}

/**
 * Parse directory listing HTML to extract XML filenames
 * Returns an array of filenames like ["HB 1.xml", "HB 2.xml", ...]
 */
function parseFileListing(html: string): string[] {
  const files: string[] = [];
  // Look for links to XML files like "HB 1.xml" or "SB 123.xml"
  const pattern = /href="([A-Z]{2,3}%20\d+\.xml)"/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    // Decode URL-encoded filename
    files.push(decodeURIComponent(match[1]));
  }
  return files.sort((a, b) => {
    // Sort by bill number
    const numA = parseInt(a.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.match(/\d+/)?.[0] || '0');
    return numA - numB;
  });
}

/**
 * List all directory ranges for a bill type
 * e.g., ["HB00001_HB00099", "HB00100_HB00199", ...]
 */
export async function listBillDirectories(
  sessionCode: string,
  billType: string
): Promise<string[]> {
  const url = buildDirectoryListUrl(sessionCode, billType);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TxLegAI Bill Sync Bot (educational/research)',
      },
    });

    if (!response.ok) {
      console.error(`Failed to list directories for ${billType}: ${response.status}`);
      return [];
    }

    const html = await response.text();
    return parseDirectoryListing(html);
  } catch (error) {
    console.error(`Error listing directories for ${billType}:`, error);
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
  const billTypePath = getBillTypePath(billType);
  const url = `${FTP_BASE_URL}/bills/${sessionCode}/billhistory/${billTypePath}/${dirRange}/`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TxLegAI Bill Sync Bot (educational/research)',
      },
    });

    if (!response.ok) {
      console.error(`Failed to list files in ${dirRange}: ${response.status}`);
      return [];
    }

    const html = await response.text();
    return parseFileListing(html);
  } catch (error) {
    console.error(`Error listing files in ${dirRange}:`, error);
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

  // Get all directory ranges
  const directories = await listBillDirectories(sessionCode, billType);

  for (const dir of directories) {
    // Get all XML files in this directory
    const files = await listBillFiles(sessionCode, billType, dir);

    // Extract bill numbers from filenames
    for (const filename of files) {
      const match = filename.match(/\d+/);
      if (match) {
        billNumbers.push(parseInt(match[0]));
      }
    }
  }

  return billNumbers.sort((a, b) => a - b);
}

/**
 * Fetch bill text HTML from the URL specified in the XML
 * Returns cleaned text content or null if not available
 */
export async function fetchBillTextFromUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TxLegAI Bill Sync Bot (educational/research)',
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
    console.error(`Error fetching bill text from ${url}:`, error);
    return null;
  }
}
