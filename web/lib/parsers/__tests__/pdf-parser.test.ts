import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parsePdfFromUrl,
  parsePdfFromBuffer,
  getBillPdfUrl,
  isValidBillType,
  BILL_VERSIONS,
  type PdfParseResult,
} from '../pdf-parser';

// Mock the PDFParse class from pdf-parse
const mockGetText = vi.fn();
const mockDestroy = vi.fn();

vi.mock('pdf-parse', () => ({
  PDFParse: vi.fn().mockImplementation(() => ({
    getText: mockGetText,
    destroy: mockDestroy,
  })),
}));

/**
 * Creates a valid PDF buffer for testing.
 * A minimal PDF starts with %PDF- magic bytes.
 */
function createMockPdfBuffer(content: string = 'Test PDF content'): Buffer {
  // PDF magic bytes followed by minimal content
  const pdfHeader = '%PDF-1.4\n';
  return Buffer.from(pdfHeader + content);
}

/**
 * Creates a mock fetch response
 */
function createMockResponse(
  buffer: Buffer,
  options: { ok?: boolean; status?: number; statusText?: string } = {}
): Response {
  const { ok = true, status = 200, statusText = 'OK' } = options;
  return {
    ok,
    status,
    statusText,
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  } as Response;
}

describe('parsePdfFromBuffer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully parses a valid PDF buffer', async () => {
    const mockBuffer = createMockPdfBuffer();
    mockGetText.mockResolvedValueOnce({
      text: 'Extracted text from PDF',
      total: 5,
      pages: [],
      getPageText: vi.fn(),
    });

    const result = await parsePdfFromBuffer(mockBuffer);

    expect(result).toEqual({
      success: true,
      text: 'Extracted text from PDF',
      pageCount: 5,
    });
  });

  it('returns error for null input', async () => {
    const result = await parsePdfFromBuffer(null as unknown as Buffer);

    expect(result).toEqual({
      success: false,
      text: null,
      pageCount: 0,
      error: 'Invalid input: expected a Buffer',
    });
    expect(mockGetText).not.toHaveBeenCalled();
  });

  it('returns error for undefined input', async () => {
    const result = await parsePdfFromBuffer(undefined as unknown as Buffer);

    expect(result).toEqual({
      success: false,
      text: null,
      pageCount: 0,
      error: 'Invalid input: expected a Buffer',
    });
  });

  it('returns error for non-Buffer input', async () => {
    const result = await parsePdfFromBuffer('not a buffer' as unknown as Buffer);

    expect(result).toEqual({
      success: false,
      text: null,
      pageCount: 0,
      error: 'Invalid input: expected a Buffer',
    });
  });

  it('returns error for empty buffer', async () => {
    const result = await parsePdfFromBuffer(Buffer.alloc(0));

    expect(result).toEqual({
      success: false,
      text: null,
      pageCount: 0,
      error: 'Invalid input: buffer is empty',
    });
  });

  it('returns error for invalid PDF (missing magic bytes)', async () => {
    const invalidBuffer = Buffer.from('This is not a PDF file');

    const result = await parsePdfFromBuffer(invalidBuffer);

    expect(result).toEqual({
      success: false,
      text: null,
      pageCount: 0,
      error: 'Invalid PDF: file does not start with PDF signature',
    });
  });

  it('handles pdf-parse errors gracefully', async () => {
    const mockBuffer = createMockPdfBuffer();
    mockGetText.mockRejectedValueOnce(new Error('PDF parsing failed: corrupted file'));

    const result = await parsePdfFromBuffer(mockBuffer);

    expect(result).toEqual({
      success: false,
      text: null,
      pageCount: 0,
      error: 'Failed to parse PDF: PDF parsing failed: corrupted file',
    });
  });

  it('handles unknown error types gracefully', async () => {
    const mockBuffer = createMockPdfBuffer();
    mockGetText.mockRejectedValueOnce('String error');

    const result = await parsePdfFromBuffer(mockBuffer);

    expect(result).toEqual({
      success: false,
      text: null,
      pageCount: 0,
      error: 'Failed to parse PDF: Unknown error occurred',
    });
  });

  it('handles PDF with empty text', async () => {
    const mockBuffer = createMockPdfBuffer();
    mockGetText.mockResolvedValueOnce({
      text: '',
      total: 1,
      pages: [],
      getPageText: vi.fn(),
    });

    const result = await parsePdfFromBuffer(mockBuffer);

    expect(result).toEqual({
      success: true,
      text: '',
      pageCount: 1,
    });
  });

  it('handles PDF with undefined text field', async () => {
    const mockBuffer = createMockPdfBuffer();
    mockGetText.mockResolvedValueOnce({
      text: undefined as unknown as string,
      total: 2,
      pages: [],
      getPageText: vi.fn(),
    });

    const result = await parsePdfFromBuffer(mockBuffer);

    expect(result).toEqual({
      success: true,
      text: '',
      pageCount: 2,
    });
  });

  it('calls destroy on the parser after successful parsing', async () => {
    const mockBuffer = createMockPdfBuffer();
    mockGetText.mockResolvedValueOnce({
      text: 'Test',
      total: 1,
      pages: [],
      getPageText: vi.fn(),
    });

    await parsePdfFromBuffer(mockBuffer);

    expect(mockDestroy).toHaveBeenCalled();
  });

  it('calls destroy on the parser even after an error', async () => {
    const mockBuffer = createMockPdfBuffer();
    mockGetText.mockRejectedValueOnce(new Error('Test error'));

    await parsePdfFromBuffer(mockBuffer);

    expect(mockDestroy).toHaveBeenCalled();
  });
});

describe('parsePdfFromUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully parses PDF from URL', async () => {
    const mockBuffer = createMockPdfBuffer();
    const mockFetch = vi.fn().mockResolvedValueOnce(createMockResponse(mockBuffer));

    mockGetText.mockResolvedValueOnce({
      text: 'Bill text content',
      total: 10,
      pages: [],
      getPageText: vi.fn(),
    });

    const result = await parsePdfFromUrl('https://example.com/document.pdf', {
      fetchFn: mockFetch,
    });

    expect(result).toEqual({
      success: true,
      text: 'Bill text content',
      pageCount: 10,
    });
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/document.pdf');
  });

  it('returns error for empty URL', async () => {
    const result = await parsePdfFromUrl('');

    expect(result).toEqual({
      success: false,
      text: null,
      pageCount: 0,
      error: 'Invalid URL: URL must be a non-empty string',
    });
  });

  it('returns error for null URL', async () => {
    const result = await parsePdfFromUrl(null as unknown as string);

    expect(result).toEqual({
      success: false,
      text: null,
      pageCount: 0,
      error: 'Invalid URL: URL must be a non-empty string',
    });
  });

  it('returns error for invalid URL format', async () => {
    const result = await parsePdfFromUrl('not-a-valid-url');

    expect(result).toEqual({
      success: false,
      text: null,
      pageCount: 0,
      error: 'Invalid URL format: not-a-valid-url',
    });
  });

  it('returns error for unsupported protocol', async () => {
    const result = await parsePdfFromUrl('ftp://example.com/document.pdf');

    expect(result).toEqual({
      success: false,
      text: null,
      pageCount: 0,
      error: 'Invalid URL protocol: ftp:. Only http and https are supported.',
    });
  });

  it('returns error for file protocol', async () => {
    const result = await parsePdfFromUrl('file:///path/to/document.pdf');

    expect(result).toEqual({
      success: false,
      text: null,
      pageCount: 0,
      error: 'Invalid URL protocol: file:. Only http and https are supported.',
    });
  });

  it('handles HTTP error responses', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      createMockResponse(Buffer.alloc(0), { ok: false, status: 404, statusText: 'Not Found' })
    );

    const result = await parsePdfFromUrl('https://example.com/missing.pdf', {
      fetchFn: mockFetch,
    });

    expect(result).toEqual({
      success: false,
      text: null,
      pageCount: 0,
      error: 'HTTP error: 404 Not Found',
    });
  });

  it('handles HTTP 500 error', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      createMockResponse(Buffer.alloc(0), { ok: false, status: 500, statusText: 'Internal Server Error' })
    );

    const result = await parsePdfFromUrl('https://example.com/error.pdf', {
      fetchFn: mockFetch,
    });

    expect(result).toEqual({
      success: false,
      text: null,
      pageCount: 0,
      error: 'HTTP error: 500 Internal Server Error',
    });
  });

  it('handles network errors', async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error('Network request failed'));

    const result = await parsePdfFromUrl('https://example.com/document.pdf', {
      fetchFn: mockFetch,
    });

    expect(result).toEqual({
      success: false,
      text: null,
      pageCount: 0,
      error: 'Failed to fetch PDF: Network request failed',
    });
  });

  it('handles DNS resolution errors', async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND example.com'));

    const result = await parsePdfFromUrl('https://example.com/document.pdf', {
      fetchFn: mockFetch,
    });

    expect(result).toEqual({
      success: false,
      text: null,
      pageCount: 0,
      error: 'Failed to fetch PDF: getaddrinfo ENOTFOUND example.com',
    });
  });

  it('handles timeout errors', async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error('Request timed out'));

    const result = await parsePdfFromUrl('https://example.com/document.pdf', {
      fetchFn: mockFetch,
    });

    expect(result).toEqual({
      success: false,
      text: null,
      pageCount: 0,
      error: 'Failed to fetch PDF: Request timed out',
    });
  });

  it('handles unknown fetch errors', async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce('Unknown error string');

    const result = await parsePdfFromUrl('https://example.com/document.pdf', {
      fetchFn: mockFetch,
    });

    expect(result).toEqual({
      success: false,
      text: null,
      pageCount: 0,
      error: 'Failed to fetch PDF: Unknown error occurred',
    });
  });

  it('works with http URLs', async () => {
    const mockBuffer = createMockPdfBuffer();
    const mockFetch = vi.fn().mockResolvedValueOnce(createMockResponse(mockBuffer));

    mockGetText.mockResolvedValueOnce({
      text: 'Content',
      total: 1,
      pages: [],
      getPageText: vi.fn(),
    });

    const result = await parsePdfFromUrl('http://example.com/document.pdf', {
      fetchFn: mockFetch,
    });

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith('http://example.com/document.pdf');
  });
});

describe('getBillPdfUrl', () => {
  it('constructs URL for HB 1', () => {
    const url = getBillPdfUrl('89R', 'HB', 1);
    expect(url).toBe('https://capitol.texas.gov/tlodocs/89R/billtext/pdf/HB00001I.pdf');
  });

  it('constructs URL for SB 123', () => {
    const url = getBillPdfUrl('89R', 'SB', 123);
    expect(url).toBe('https://capitol.texas.gov/tlodocs/89R/billtext/pdf/SB00123I.pdf');
  });

  it('constructs URL for HJR 10', () => {
    const url = getBillPdfUrl('89R', 'HJR', 10);
    expect(url).toBe('https://capitol.texas.gov/tlodocs/89R/billtext/pdf/HJR00010I.pdf');
  });

  it('constructs URL for SJR 5', () => {
    const url = getBillPdfUrl('89R', 'SJR', 5);
    expect(url).toBe('https://capitol.texas.gov/tlodocs/89R/billtext/pdf/SJR00005I.pdf');
  });

  it('constructs URL for HCR 200', () => {
    const url = getBillPdfUrl('89R', 'HCR', 200);
    expect(url).toBe('https://capitol.texas.gov/tlodocs/89R/billtext/pdf/HCR00200I.pdf');
  });

  it('constructs URL for SCR 50', () => {
    const url = getBillPdfUrl('89R', 'SCR', 50);
    expect(url).toBe('https://capitol.texas.gov/tlodocs/89R/billtext/pdf/SCR00050I.pdf');
  });

  it('pads bill numbers correctly', () => {
    expect(getBillPdfUrl('89R', 'HB', 1)).toContain('HB00001');
    expect(getBillPdfUrl('89R', 'HB', 12)).toContain('HB00012');
    expect(getBillPdfUrl('89R', 'HB', 123)).toContain('HB00123');
    expect(getBillPdfUrl('89R', 'HB', 1234)).toContain('HB01234');
    expect(getBillPdfUrl('89R', 'HB', 12345)).toContain('HB12345');
  });

  it('uses custom version codes', () => {
    const url = getBillPdfUrl('89R', 'HB', 1, 'E');
    expect(url).toBe('https://capitol.texas.gov/tlodocs/89R/billtext/pdf/HB00001E.pdf');
  });

  it('uses Enrolled version code', () => {
    const url = getBillPdfUrl('89R', 'SB', 500, 'F');
    expect(url).toBe('https://capitol.texas.gov/tlodocs/89R/billtext/pdf/SB00500F.pdf');
  });

  it('uses Committee Substitute version code', () => {
    const url = getBillPdfUrl('89R', 'HB', 100, 'C');
    expect(url).toBe('https://capitol.texas.gov/tlodocs/89R/billtext/pdf/HB00100C.pdf');
  });

  it('handles different sessions', () => {
    expect(getBillPdfUrl('88R', 'HB', 1)).toContain('/88R/');
    expect(getBillPdfUrl('89R', 'HB', 1)).toContain('/89R/');
    expect(getBillPdfUrl('883', 'HB', 1)).toContain('/883/'); // Special sessions
    expect(getBillPdfUrl('881', 'HB', 1)).toContain('/881/');
  });

  it('works with BILL_VERSIONS constants', () => {
    expect(getBillPdfUrl('89R', 'HB', 1, BILL_VERSIONS.INTRODUCED)).toContain('HB00001I.pdf');
    expect(getBillPdfUrl('89R', 'HB', 1, BILL_VERSIONS.ENGROSSED)).toContain('HB00001E.pdf');
    expect(getBillPdfUrl('89R', 'HB', 1, BILL_VERSIONS.ENROLLED)).toContain('HB00001F.pdf');
    expect(getBillPdfUrl('89R', 'HB', 1, BILL_VERSIONS.COMMITTEE_SUBSTITUTE)).toContain('HB00001C.pdf');
    expect(getBillPdfUrl('89R', 'HB', 1, BILL_VERSIONS.HOUSE_COMMITTEE_REPORT)).toContain('HB00001H.pdf');
    expect(getBillPdfUrl('89R', 'HB', 1, BILL_VERSIONS.SENATE_COMMITTEE_REPORT)).toContain('HB00001S.pdf');
  });
});

describe('isValidBillType', () => {
  it('returns true for HB', () => {
    expect(isValidBillType('HB')).toBe(true);
  });

  it('returns true for SB', () => {
    expect(isValidBillType('SB')).toBe(true);
  });

  it('returns true for HJR', () => {
    expect(isValidBillType('HJR')).toBe(true);
  });

  it('returns true for SJR', () => {
    expect(isValidBillType('SJR')).toBe(true);
  });

  it('returns true for HCR', () => {
    expect(isValidBillType('HCR')).toBe(true);
  });

  it('returns true for SCR', () => {
    expect(isValidBillType('SCR')).toBe(true);
  });

  it('returns true for lowercase bill types', () => {
    expect(isValidBillType('hb')).toBe(true);
    expect(isValidBillType('sb')).toBe(true);
    expect(isValidBillType('hjr')).toBe(true);
    expect(isValidBillType('sjr')).toBe(true);
    expect(isValidBillType('hcr')).toBe(true);
    expect(isValidBillType('scr')).toBe(true);
  });

  it('returns true for mixed case bill types', () => {
    expect(isValidBillType('Hb')).toBe(true);
    expect(isValidBillType('hJR')).toBe(true);
  });

  it('returns false for invalid bill types', () => {
    expect(isValidBillType('XYZ')).toBe(false);
    expect(isValidBillType('ABC')).toBe(false);
    expect(isValidBillType('HR')).toBe(false);
    expect(isValidBillType('SR')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidBillType('')).toBe(false);
  });

  it('returns false for partial matches', () => {
    expect(isValidBillType('H')).toBe(false);
    expect(isValidBillType('HBX')).toBe(false);
  });
});

describe('BILL_VERSIONS', () => {
  it('has correct version codes', () => {
    expect(BILL_VERSIONS.INTRODUCED).toBe('I');
    expect(BILL_VERSIONS.ENGROSSED).toBe('E');
    expect(BILL_VERSIONS.ENROLLED).toBe('F');
    expect(BILL_VERSIONS.COMMITTEE_SUBSTITUTE).toBe('C');
    expect(BILL_VERSIONS.HOUSE_COMMITTEE_REPORT).toBe('H');
    expect(BILL_VERSIONS.SENATE_COMMITTEE_REPORT).toBe('S');
  });
});

describe('Integration: parsePdfFromUrl with getBillPdfUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('constructs valid URL that can be parsed', async () => {
    const url = getBillPdfUrl('89R', 'HB', 1);
    const mockBuffer = createMockPdfBuffer();
    const mockFetch = vi.fn().mockResolvedValueOnce(createMockResponse(mockBuffer));

    mockGetText.mockResolvedValueOnce({
      text: 'AN ACT relating to appropriations...',
      total: 500,
      pages: [],
      getPageText: vi.fn(),
    });

    const result = await parsePdfFromUrl(url, { fetchFn: mockFetch });

    expect(result.success).toBe(true);
    expect(result.text).toBe('AN ACT relating to appropriations...');
    expect(result.pageCount).toBe(500);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://capitol.texas.gov/tlodocs/89R/billtext/pdf/HB00001I.pdf'
    );
  });
});

describe('Type inference', () => {
  it('PdfParseResult has correct shape for success case', () => {
    const successResult: PdfParseResult = {
      success: true,
      text: 'content',
      pageCount: 1,
    };
    expect(successResult.success).toBe(true);
    expect(successResult.text).toBe('content');
    expect(successResult.pageCount).toBe(1);
    expect(successResult.error).toBeUndefined();
  });

  it('PdfParseResult has correct shape for error case', () => {
    const errorResult: PdfParseResult = {
      success: false,
      text: null,
      pageCount: 0,
      error: 'Something went wrong',
    };
    expect(errorResult.success).toBe(false);
    expect(errorResult.text).toBeNull();
    expect(errorResult.pageCount).toBe(0);
    expect(errorResult.error).toBe('Something went wrong');
  });
});
