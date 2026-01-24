/**
 * FTP Client Tests
 *
 * Tests for the FTP client utilities that fetch bill data from Texas Legislature FTP server.
 * These tests focus on the pure utility functions that don't require FTP mocking.
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// Import the function we can test without mocking FTP
import { getDirectoryRange } from '../ftp-client';

describe('FTP Client', () => {
  describe('getDirectoryRange', () => {
    it('calculates correct range for bill 1', () => {
      const range = getDirectoryRange('HB', 1);
      expect(range.start).toBe(1);
      expect(range.end).toBe(99);
      expect(range.dirname).toBe('HB00001_HB00099');
    });

    it('calculates correct range for bill 99', () => {
      const range = getDirectoryRange('HB', 99);
      expect(range.start).toBe(1);
      expect(range.end).toBe(99);
      expect(range.dirname).toBe('HB00001_HB00099');
    });

    it('calculates correct range for bill 100', () => {
      const range = getDirectoryRange('HB', 100);
      expect(range.start).toBe(100);
      expect(range.end).toBe(198);
      expect(range.dirname).toBe('HB00100_HB00198');
    });

    it('calculates correct range for bill 150', () => {
      const range = getDirectoryRange('HB', 150);
      expect(range.start).toBe(100);
      expect(range.end).toBe(198);
      expect(range.dirname).toBe('HB00100_HB00198');
    });

    it('calculates correct range for bill 1000', () => {
      const range = getDirectoryRange('SB', 1000);
      expect(range.start).toBe(991);
      expect(range.end).toBe(1089);
      expect(range.dirname).toBe('SB00991_SB01089');
    });

    it('works for different bill types', () => {
      expect(getDirectoryRange('HB', 50).dirname).toBe('HB00001_HB00099');
      expect(getDirectoryRange('SB', 50).dirname).toBe('SB00001_SB00099');
      expect(getDirectoryRange('HJR', 5).dirname).toBe('HJR00001_HJR00099');
      expect(getDirectoryRange('SJR', 10).dirname).toBe('SJR00001_SJR00099');
    });

    it('handles edge case at bill 199', () => {
      const range = getDirectoryRange('HB', 199);
      expect(range.start).toBe(199);
      expect(range.end).toBe(297);
      expect(range.dirname).toBe('HB00199_HB00297');
    });

    it('pads numbers correctly for different bill numbers', () => {
      expect(getDirectoryRange('HB', 1).dirname).toBe('HB00001_HB00099');
      expect(getDirectoryRange('HB', 100).dirname).toBe('HB00100_HB00198');
      expect(getDirectoryRange('HB', 1000).dirname).toBe('HB00991_HB01089');
      expect(getDirectoryRange('HB', 10000).dirname).toBe('HB10000_HB10098');
    });
  });

  describe('fetchBillTextFromUrl', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
      global.fetch = vi.fn();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('fetches and cleans HTML content', async () => {
      const { fetchBillTextFromUrl } = await import('../ftp-client');

      const mockHtml = `
        <html>
        <head><title>Bill Text</title></head>
        <body>
          <p>AN ACT relating to education and public safety.</p>
          <p>BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:</p>
          <p>SECTION 1. This is the bill text with special characters and formatting.</p>
          <p>SECTION 2. This bill shall take effect September 1, 2025.</p>
        </body>
        </html>
      `;

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      });

      const text = await fetchBillTextFromUrl('http://capitol.texas.gov/bill.htm');

      expect(text).toContain('AN ACT relating to education');
      expect(text).toContain('BE IT ENACTED BY THE LEGISLATURE');
      expect(text).toContain('SECTION 1');
      expect(text).not.toContain('<p>');
    });

    it('returns null for failed fetch', async () => {
      const { fetchBillTextFromUrl } = await import('../ftp-client');

      (global.fetch as Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const text = await fetchBillTextFromUrl('http://capitol.texas.gov/nonexistent.htm');

      expect(text).toBeNull();
    });

    it('returns null for error pages', async () => {
      const { fetchBillTextFromUrl } = await import('../ftp-client');

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html><body>Website Error - Page Not Found</body></html>'),
      });

      const text = await fetchBillTextFromUrl('http://capitol.texas.gov/error.htm');

      expect(text).toBeNull();
    });

    it('returns null for content shorter than 100 characters', async () => {
      const { fetchBillTextFromUrl } = await import('../ftp-client');

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html><body>Short</body></html>'),
      });

      const text = await fetchBillTextFromUrl('http://capitol.texas.gov/short.htm');

      expect(text).toBeNull();
    });

    it('truncates content at 50KB', async () => {
      const { fetchBillTextFromUrl } = await import('../ftp-client');

      const longContent = '<html><body>' + 'A'.repeat(60000) + '</body></html>';
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(longContent),
      });

      const text = await fetchBillTextFromUrl('http://capitol.texas.gov/long.htm');

      expect(text).not.toBeNull();
      expect(text!.length).toBeLessThanOrEqual(50000);
    });

    it('handles fetch exceptions gracefully', async () => {
      const { fetchBillTextFromUrl } = await import('../ftp-client');

      (global.fetch as Mock).mockRejectedValue(new Error('Network error'));

      const text = await fetchBillTextFromUrl('http://capitol.texas.gov/bill.htm');

      expect(text).toBeNull();
    });

    it('decodes HTML entities correctly', async () => {
      const { fetchBillTextFromUrl } = await import('../ftp-client');

      const htmlWithEntities = `
        <html><body>
          <p>Test with &amp; ampersand and &lt;angle&gt; brackets.</p>
          <p>&quot;Quoted text&quot; with &apos;apostrophes&apos;.</p>
          <p>Special: &mdash; &ndash; &hellip; &sect; &copy;</p>
          <p>Fractions: &frac12; &frac14; &frac34;</p>
          <p>More content to make it over 100 characters for the length check.</p>
        </body></html>
      `;

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(htmlWithEntities),
      });

      const text = await fetchBillTextFromUrl('http://capitol.texas.gov/bill.htm');

      expect(text).not.toBeNull();
      expect(text).toContain('& ampersand');
      expect(text).toContain('<angle>');
      expect(text).toContain('"Quoted text"');
      expect(text).toContain('—'); // mdash
      expect(text).toContain('§'); // sect
      expect(text).toContain('½'); // frac12
    });

    it('removes script and style tags', async () => {
      const { fetchBillTextFromUrl } = await import('../ftp-client');

      const htmlWithScripts = `
        <html>
        <head>
          <script>console.log('evil script');</script>
          <style>.hidden { display: none; }</style>
        </head>
        <body>
          <p>Bill text content that should be preserved and is definitely long enough to pass the minimum length check of one hundred characters. This is additional text to ensure the content is long enough.</p>
          <script>alert('inline script should be removed');</script>
        </body>
        </html>
      `;

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(htmlWithScripts),
      });

      const text = await fetchBillTextFromUrl('http://capitol.texas.gov/bill.htm');

      expect(text).not.toBeNull();
      expect(text).toContain('Bill text content');
      expect(text).not.toContain('console.log');
      expect(text).not.toContain('alert');
      expect(text).not.toContain('.hidden');
    });

    it('converts line breaks and block elements to newlines', async () => {
      const { fetchBillTextFromUrl } = await import('../ftp-client');

      const htmlWithBreaks = `
        <html><body>
          <p>First paragraph with more content to ensure length.</p>
          <br/>
          <p>Second paragraph after break with additional text.</p>
          <div>Content in a div element for testing purposes.</div>
        </body></html>
      `;

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(htmlWithBreaks),
      });

      const text = await fetchBillTextFromUrl('http://capitol.texas.gov/bill.htm');

      expect(text).not.toBeNull();
      expect(text).toContain('First paragraph');
      expect(text).toContain('Second paragraph');
    });
  });

  describe('directory path generation', () => {
    it('generates correct directory path for House bills', () => {
      const range = getDirectoryRange('HB', 1);
      expect(range.dirname).toBe('HB00001_HB00099');
    });

    it('generates correct directory path for Senate bills', () => {
      const range = getDirectoryRange('SB', 1);
      expect(range.dirname).toBe('SB00001_SB00099');
    });

    it('generates correct directory path for joint resolutions', () => {
      expect(getDirectoryRange('HJR', 1).dirname).toBe('HJR00001_HJR00099');
      expect(getDirectoryRange('SJR', 1).dirname).toBe('SJR00001_SJR00099');
    });

    it('generates correct directory path for concurrent resolutions', () => {
      expect(getDirectoryRange('HCR', 1).dirname).toBe('HCR00001_HCR00099');
      expect(getDirectoryRange('SCR', 1).dirname).toBe('SCR00001_SCR00099');
    });
  });
});
