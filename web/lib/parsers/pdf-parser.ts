import { PDFParse } from 'pdf-parse';

/**
 * Result of parsing a PDF document
 */
export interface PdfParseResult {
  /** Whether the parsing was successful */
  success: boolean;
  /** Extracted text content, or null if parsing failed */
  text: string | null;
  /** Number of pages in the PDF */
  pageCount: number;
  /** Error message if parsing failed */
  error?: string;
}

/**
 * Options for PDF parsing operations
 */
export interface PdfParseOptions {
  /** Custom fetch function for dependency injection (allows mocking in tests) */
  fetchFn?: typeof fetch;
}

/**
 * Valid Texas Legislature bill types
 */
export type BillType = 'HB' | 'SB' | 'HJR' | 'SJR' | 'HCR' | 'SCR';

/**
 * Base URL for Texas Capitol bill PDFs
 */
const TEXAS_CAPITOL_PDF_BASE_URL = 'https://capitol.texas.gov/tlodocs';

/**
 * Parses a PDF document from a URL and extracts its text content.
 *
 * This function fetches the PDF from the given URL and extracts all text content.
 * It handles errors gracefully, returning an error result instead of throwing.
 *
 * @param url - The URL of the PDF to parse
 * @param options - Optional configuration including custom fetch function
 * @returns A PdfParseResult containing the extracted text or error information
 *
 * @example
 * ```typescript
 * const result = await parsePdfFromUrl('https://example.com/document.pdf');
 * if (result.success) {
 *   console.log(`Extracted ${result.pageCount} pages:`, result.text);
 * } else {
 *   console.error('Failed to parse PDF:', result.error);
 * }
 * ```
 */
export async function parsePdfFromUrl(
  url: string,
  options: PdfParseOptions = {}
): Promise<PdfParseResult> {
  const { fetchFn = fetch } = options;

  // Validate URL
  if (!url || typeof url !== 'string') {
    return {
      success: false,
      text: null,
      pageCount: 0,
      error: 'Invalid URL: URL must be a non-empty string',
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return {
      success: false,
      text: null,
      pageCount: 0,
      error: `Invalid URL format: ${url}`,
    };
  }

  // Validate protocol
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return {
      success: false,
      text: null,
      pageCount: 0,
      error: `Invalid URL protocol: ${parsedUrl.protocol}. Only http and https are supported.`,
    };
  }

  try {
    // Fetch the PDF
    const response = await fetchFn(url);

    if (!response.ok) {
      return {
        success: false,
        text: null,
        pageCount: 0,
        error: `HTTP error: ${response.status} ${response.statusText}`,
      };
    }

    // Get the PDF buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse the PDF
    return await parsePdfFromBuffer(buffer);
  } catch (error) {
    // Handle network errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      text: null,
      pageCount: 0,
      error: `Failed to fetch PDF: ${errorMessage}`,
    };
  }
}

/**
 * Parses a PDF document from a buffer and extracts its text content.
 *
 * This function takes a Buffer containing PDF data and extracts all text content.
 * It handles errors gracefully, returning an error result instead of throwing.
 *
 * @param buffer - Buffer containing the PDF data
 * @returns A PdfParseResult containing the extracted text or error information
 *
 * @example
 * ```typescript
 * import { readFileSync } from 'fs';
 *
 * const pdfBuffer = readFileSync('document.pdf');
 * const result = await parsePdfFromBuffer(pdfBuffer);
 * if (result.success) {
 *   console.log(`Extracted ${result.pageCount} pages:`, result.text);
 * }
 * ```
 */
export async function parsePdfFromBuffer(buffer: Buffer): Promise<PdfParseResult> {
  // Validate buffer
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return {
      success: false,
      text: null,
      pageCount: 0,
      error: 'Invalid input: expected a Buffer',
    };
  }

  if (buffer.length === 0) {
    return {
      success: false,
      text: null,
      pageCount: 0,
      error: 'Invalid input: buffer is empty',
    };
  }

  // Check for PDF magic bytes (%PDF-)
  const pdfMagicBytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D]); // %PDF-
  if (!buffer.subarray(0, 5).equals(pdfMagicBytes)) {
    return {
      success: false,
      text: null,
      pageCount: 0,
      error: 'Invalid PDF: file does not start with PDF signature',
    };
  }

  let parser: PDFParse | null = null;
  try {
    // Create PDFParse instance with the buffer data
    // Convert Buffer to Uint8Array for pdf-parse v2.x
    const uint8Array = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    parser = new PDFParse({ data: uint8Array });

    // Get text result
    const textResult = await parser.getText();

    return {
      success: true,
      text: textResult.text || '',
      pageCount: textResult.total || 0,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      text: null,
      pageCount: 0,
      error: `Failed to parse PDF: ${errorMessage}`,
    };
  } finally {
    // Clean up the parser instance
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Constructs the URL for a Texas Legislature bill PDF.
 *
 * Texas Capitol bill PDFs follow a specific URL pattern:
 * https://capitol.texas.gov/tlodocs/{session}/billtext/pdf/{billType}{paddedNumber}{version}.pdf
 *
 * @param session - The legislative session (e.g., '89R' for 89th Regular Session)
 * @param billType - The type of bill (HB, SB, HJR, SJR, HCR, or SCR)
 * @param billNumber - The bill number
 * @param version - The bill version (default: 'I' for Introduced)
 * @returns The complete URL for the bill PDF
 *
 * @example
 * ```typescript
 * // Get URL for HB 1 from the 89th Regular Session
 * const url = getBillPdfUrl('89R', 'HB', 1);
 * // Returns: https://capitol.texas.gov/tlodocs/89R/billtext/pdf/HB00001I.pdf
 *
 * // Get URL for SB 123 with Enrolled version
 * const enrolledUrl = getBillPdfUrl('89R', 'SB', 123, 'E');
 * // Returns: https://capitol.texas.gov/tlodocs/89R/billtext/pdf/SB00123E.pdf
 * ```
 */
export function getBillPdfUrl(
  session: string,
  billType: BillType,
  billNumber: number,
  version: string = 'I'
): string {
  // Pad bill number to 5 digits
  const paddedNumber = billNumber.toString().padStart(5, '0');

  // Construct the filename
  const filename = `${billType}${paddedNumber}${version}.pdf`;

  return `${TEXAS_CAPITOL_PDF_BASE_URL}/${session}/billtext/pdf/${filename}`;
}

/**
 * Validates if a string is a valid Texas Legislature bill type.
 *
 * @param type - The string to validate
 * @returns True if the string is a valid bill type
 *
 * @example
 * ```typescript
 * isValidBillType('HB');  // true
 * isValidBillType('XYZ'); // false
 * ```
 */
export function isValidBillType(type: string): type is BillType {
  return ['HB', 'SB', 'HJR', 'SJR', 'HCR', 'SCR'].includes(type.toUpperCase());
}

/**
 * Bill version codes used by the Texas Legislature
 */
export const BILL_VERSIONS = {
  /** Introduced version */
  INTRODUCED: 'I',
  /** Engrossed version (passed originating chamber) */
  ENGROSSED: 'E',
  /** Enrolled version (passed both chambers) */
  ENROLLED: 'F',
  /** Committee substitute */
  COMMITTEE_SUBSTITUTE: 'C',
  /** House committee report */
  HOUSE_COMMITTEE_REPORT: 'H',
  /** Senate committee report */
  SENATE_COMMITTEE_REPORT: 'S',
} as const;
