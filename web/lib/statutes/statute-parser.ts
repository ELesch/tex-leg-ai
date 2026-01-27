/**
 * Statute Parser
 * Parses Texas statute HTML content to extract sections.
 *
 * The Texas statutes website (statutes.capitol.texas.gov) uses a modern SPA,
 * so content must be fetched via their API or using headless browser.
 * This parser handles the extracted HTML/text content.
 */

export interface ParsedSection {
  sectionNum: string;        // "29.001"
  heading: string | null;    // "DEFINITIONS"
  text: string;              // Plain text content
  textHtml: string | null;   // Original HTML (if available)
  chapterNum: string;        // "29"
  subchapter: string | null; // "A"
  subchapterTitle: string | null;
}

export interface ParsedChapter {
  chapterNum: string;
  chapterTitle: string | null;
  sections: ParsedSection[];
}

/**
 * Extract text content from HTML, preserving paragraph structure
 */
export function extractTextFromHtml(html: string): string {
  const text = html
    // Remove script and style tags
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Convert block elements to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<(p|div)[^>]*>/gi, '\n')
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&#xA0;/gi, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#x26;/gi, '&')
    .replace(/&#38;/g, '&')
    .replace(/&amp;/gi, '&')
    .replace(/&#x3C;/gi, '<')
    .replace(/&#60;/g, '<')
    .replace(/&lt;/gi, '<')
    .replace(/&#x3E;/gi, '>')
    .replace(/&#62;/g, '>')
    .replace(/&gt;/gi, '>')
    .replace(/&#x22;/gi, '"')
    .replace(/&#34;/g, '"')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#x2014;/gi, '—')
    .replace(/&#8212;/g, '—')
    .replace(/&mdash;/gi, '—')
    .replace(/&#x2013;/gi, '–')
    .replace(/&#8211;/g, '–')
    .replace(/&ndash;/gi, '–')
    .replace(/&#xA7;/gi, '§')
    .replace(/&#167;/g, '§')
    .replace(/&sect;/gi, '§')
    // Generic hex entity decoder
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    // Generic decimal entity decoder
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    // Clean up whitespace
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/^ +/gm, '')
    .replace(/ +$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

/**
 * Parse section number from text like "Sec. 29.001" or "Section 29.001"
 * Returns null if no valid section number found
 */
export function parseSectionNumber(text: string): string | null {
  const match = text.match(/(?:Sec\.|Section)\s*(\d+\.\d+[A-Za-z]?)/i);
  return match ? match[1] : null;
}

/**
 * Extract chapter number from section number
 * "29.001" -> "29"
 * "29A.001" -> "29A"
 */
export function extractChapterFromSection(sectionNum: string): string {
  const match = sectionNum.match(/^(\d+[A-Za-z]?)\./);
  return match ? match[1] : sectionNum.split('.')[0];
}

/**
 * Parse section heading from text like "Sec. 29.001. DEFINITIONS."
 * Returns null if no heading found
 */
export function parseSectionHeading(text: string): string | null {
  // Pattern: Sec. X.XXX. HEADING TEXT.
  const match = text.match(/(?:Sec\.|Section)\s*\d+\.\d+[A-Za-z]?\.\s*([A-Z][A-Z\s,;-]+?)\.(?:\s|$)/);
  if (match) {
    return match[1].trim();
  }
  return null;
}

/**
 * Parse subchapter info from HTML
 * Looks for patterns like "SUBCHAPTER A. GENERAL PROVISIONS"
 */
export function parseSubchapterInfo(html: string): { subchapter: string | null; title: string | null } {
  const match = html.match(/SUBCHAPTER\s+([A-Z])\.\s*([A-Z][A-Z\s,;-]+)/i);
  if (match) {
    return {
      subchapter: match[1],
      title: match[2].trim()
    };
  }
  return { subchapter: null, title: null };
}

/**
 * Parse a chapter HTML page into individual sections
 * This handles the expected format from Texas statutes website
 */
export function parseChapterHtml(html: string, chapterNum: string): ParsedChapter {
  const sections: ParsedSection[] = [];

  // Extract chapter title if present
  const chapterTitleMatch = html.match(/CHAPTER\s+\d+[A-Za-z]?\.\s*([A-Z][A-Z\s,;-]+?)(?:<|$)/i);
  const chapterTitle = chapterTitleMatch ? chapterTitleMatch[1].trim() : null;

  // Split by section markers
  // Looking for patterns like: "Sec. 29.001." or "<b>Sec. 29.001.</b>"
  const sectionPattern = /(?:Sec\.|Section)\s*(\d+\.\d+[A-Za-z]?)\.(?:\s*<\/[^>]+>)?\s*([A-Z][A-Z\s,;-]*?)\./gi;

  // Find all section positions
  const sectionPositions: Array<{ index: number; sectionNum: string; heading: string }> = [];
  let match;

  while ((match = sectionPattern.exec(html)) !== null) {
    sectionPositions.push({
      index: match.index,
      sectionNum: match[1],
      heading: match[2].trim()
    });
  }

  // Extract content for each section
  let currentSubchapter: string | null = null;
  let currentSubchapterTitle: string | null = null;

  for (let i = 0; i < sectionPositions.length; i++) {
    const pos = sectionPositions[i];
    const endIndex = i < sectionPositions.length - 1
      ? sectionPositions[i + 1].index
      : html.length;

    const sectionHtml = html.substring(pos.index, endIndex);

    // Check for subchapter marker before this section
    const precedingHtml = html.substring(
      i > 0 ? sectionPositions[i - 1].index + 100 : 0,
      pos.index
    );
    const subchapterInfo = parseSubchapterInfo(precedingHtml);
    if (subchapterInfo.subchapter) {
      currentSubchapter = subchapterInfo.subchapter;
      currentSubchapterTitle = subchapterInfo.title;
    }

    const text = extractTextFromHtml(sectionHtml);

    sections.push({
      sectionNum: pos.sectionNum,
      heading: pos.heading || null,
      text: text,
      textHtml: sectionHtml.trim(),
      chapterNum: extractChapterFromSection(pos.sectionNum),
      subchapter: currentSubchapter,
      subchapterTitle: currentSubchapterTitle
    });
  }

  return {
    chapterNum,
    chapterTitle,
    sections
  };
}

/**
 * Parse statute content from the Texas API response format
 * The API returns section data in a structured format
 */
export interface ApiSectionData {
  Code: string;
  Section: string;
  Heading: string;
  Text: string;
  Chapter?: string;
  ChapterTitle?: string;
  Subchapter?: string;
  SubchapterTitle?: string;
}

export function parseApiSection(data: ApiSectionData): ParsedSection {
  return {
    sectionNum: data.Section,
    heading: data.Heading || null,
    text: extractTextFromHtml(data.Text),
    textHtml: data.Text,
    chapterNum: data.Chapter || extractChapterFromSection(data.Section),
    subchapter: data.Subchapter || null,
    subchapterTitle: data.SubchapterTitle || null
  };
}

/**
 * Create a placeholder statute entry for sections we can't fetch
 * Links to the official source
 */
export function createPlaceholderSection(
  codeAbbreviation: string,
  sectionNum: string,
  sourceUrl: string
): ParsedSection {
  return {
    sectionNum,
    heading: null,
    text: `[Statute text available at official source: ${sourceUrl}]`,
    textHtml: null,
    chapterNum: extractChapterFromSection(sectionNum),
    subchapter: null,
    subchapterTitle: null
  };
}
