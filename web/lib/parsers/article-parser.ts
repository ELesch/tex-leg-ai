/**
 * Article Parser
 *
 * Parses Texas legislative bill text to extract article structure,
 * particularly useful for omnibus bills that contain multiple articles.
 */

/** Represents a single article in a bill */
export interface BillArticle {
  /** Article number as string (supports both Arabic "1" and Roman "I" numerals) */
  articleNumber: string;
  /** Title of the article (e.g., "CHANGES RELATED TO PUBLIC EDUCATION") */
  title: string;
  /** Line number where the article starts (1-indexed) */
  startLine: number;
  /** Line number where the article ends (1-indexed, inclusive) */
  endLine: number;
  /** Section numbers contained within this article (e.g., ["1.01", "1.02"]) */
  sections: string[];
}

/**
 * Pattern to match ARTICLE declarations
 * Supports both Arabic and Roman numerals:
 * - ARTICLE 1.  TITLE HERE
 * - ARTICLE I.  TITLE HERE
 * - ARTICLE IV.  TITLE HERE
 */
const ARTICLE_REGEX = /^ARTICLE\s+(\d+|[IVXLCDM]+)\.\s*(.*)$/i;

/**
 * Pattern to match SECTION declarations within articles
 * For omnibus bills, sections typically have two-part numbers (e.g., "1.01")
 * For simple bills, sections have single numbers (e.g., "1")
 */
const SECTION_IN_ARTICLE_REGEX = /^SECTION\s+(\d+(?:\.\d+)?)\./;

/**
 * Converts Roman numerals to Arabic numbers
 * @param roman - Roman numeral string (e.g., "IV", "XII")
 * @returns Arabic number, or the original string if not a valid Roman numeral
 */
function romanToArabic(roman: string): number | null {
  const romanNumerals: { [key: string]: number } = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };

  // Check if it's a valid Roman numeral
  if (!/^[IVXLCDM]+$/i.test(roman)) {
    return null;
  }

  const upperRoman = roman.toUpperCase();
  let result = 0;
  let prevValue = 0;

  for (let i = upperRoman.length - 1; i >= 0; i--) {
    const currentValue = romanNumerals[upperRoman[i]];
    if (currentValue < prevValue) {
      result -= currentValue;
    } else {
      result += currentValue;
    }
    prevValue = currentValue;
  }

  return result;
}

/**
 * Checks if a string is a valid Roman numeral
 * @param str - String to check
 * @returns True if valid Roman numeral
 */
function isRomanNumeral(str: string): boolean {
  return /^[IVXLCDM]+$/i.test(str);
}

/**
 * Normalizes article number for consistent ordering
 * @param articleNumber - Article number (Arabic or Roman)
 * @returns Normalized number for sorting
 */
export function normalizeArticleNumber(articleNumber: string): number {
  // Try parsing as Arabic number first
  const arabic = parseInt(articleNumber, 10);
  if (!isNaN(arabic)) {
    return arabic;
  }

  // Try parsing as Roman numeral
  const romanValue = romanToArabic(articleNumber);
  return romanValue ?? 0;
}

/**
 * Extracts sections belonging to an article based on section numbering
 * For omnibus bills, sections are typically numbered as X.XX where X is the article number
 * @param lines - All lines of the bill text
 * @param startLine - Start line of the article (0-indexed)
 * @param endLine - End line of the article (0-indexed, exclusive)
 * @param articleNumber - The article number (for matching section prefixes)
 * @returns Array of section numbers
 */
function extractArticleSections(
  lines: string[],
  startLine: number,
  endLine: number,
  articleNumber: string
): string[] {
  const sections: string[] = [];
  const normalizedArticleNum = normalizeArticleNumber(articleNumber);

  for (let i = startLine; i < endLine; i++) {
    const line = lines[i];
    const sectionMatch = line.match(SECTION_IN_ARTICLE_REGEX);

    if (sectionMatch) {
      const sectionNumber = sectionMatch[1];

      // Check if section belongs to this article (e.g., "1.01" belongs to Article 1)
      // For omnibus bills with X.XX format
      if (sectionNumber.includes('.')) {
        const articlePart = parseInt(sectionNumber.split('.')[0], 10);
        if (articlePart === normalizedArticleNum) {
          sections.push(sectionNumber);
        }
      } else {
        // For bills where sections aren't prefixed with article number
        // Just include all sections within the article boundaries
        sections.push(sectionNumber);
      }
    }
  }

  return sections;
}

/**
 * Cleans up the article title
 * @param title - Raw title text
 * @returns Cleaned title
 */
function cleanTitle(title: string): string {
  return title
    .trim()
    // Remove any trailing periods or whitespace
    .replace(/\.$/, '')
    .trim();
}

/**
 * Parses bill text to extract article structure
 *
 * This function identifies ARTICLE declarations in Texas legislative bills
 * and extracts their structure including:
 * - Article number (supports both Arabic and Roman numerals)
 * - Article title
 * - Line boundaries
 * - Sections contained within each article
 *
 * @param billText - The full text of the bill
 * @returns Array of BillArticle objects, or empty array if no articles found
 *
 * @example
 * ```typescript
 * const articles = parseArticles(billText);
 * // Returns:
 * // [
 * //   {
 * //     articleNumber: "1",
 * //     title: "CHANGES RELATED TO PUBLIC EDUCATION",
 * //     startLine: 15,
 * //     endLine: 245,
 * //     sections: ["1.01", "1.02", "1.03"]
 * //   }
 * // ]
 * ```
 */
export function parseArticles(billText: string): BillArticle[] {
  // Handle empty or invalid input
  if (!billText || typeof billText !== 'string') {
    return [];
  }

  const lines = billText.split('\n');
  const articles: BillArticle[] = [];

  // First pass: find all article declarations
  const articleDeclarations: Array<{
    number: string;
    title: string;
    lineIndex: number;
  }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(ARTICLE_REGEX);

    if (match) {
      articleDeclarations.push({
        number: match[1],
        title: cleanTitle(match[2]),
        lineIndex: i,
      });
    }
  }

  // If no articles found, return empty array
  if (articleDeclarations.length === 0) {
    return [];
  }

  // Second pass: determine article boundaries and extract sections
  for (let i = 0; i < articleDeclarations.length; i++) {
    const current = articleDeclarations[i];
    const next = articleDeclarations[i + 1];

    // Article starts at its declaration line
    const startLine = current.lineIndex;

    // Article ends at the line before the next article, or at the end of the document
    const endLine = next ? next.lineIndex - 1 : lines.length - 1;

    // Extract sections within this article
    const sections = extractArticleSections(
      lines,
      startLine,
      endLine + 1, // +1 because slice is exclusive
      current.number
    );

    // Handle case where title might be on the next line
    let title = current.title;
    if (!title && startLine + 1 < lines.length) {
      // Check if the next line looks like a title (all caps, no SECTION prefix)
      const nextLine = lines[startLine + 1].trim();
      if (nextLine && /^[A-Z\s]+$/.test(nextLine) && !nextLine.startsWith('SECTION')) {
        title = cleanTitle(nextLine);
      }
    }

    articles.push({
      articleNumber: current.number,
      title: title || `ARTICLE ${current.number}`,
      startLine: startLine + 1, // Convert to 1-indexed
      endLine: endLine + 1, // Convert to 1-indexed
      sections,
    });
  }

  return articles;
}

/**
 * Checks if a bill has an article structure (is likely an omnibus bill)
 * @param billText - The full text of the bill
 * @returns True if the bill contains ARTICLE declarations
 */
export function hasArticleStructure(billText: string): boolean {
  if (!billText || typeof billText !== 'string') {
    return false;
  }

  // Use multiline regex to check for ARTICLE at start of any line
  const multilineArticleRegex = /^ARTICLE\s+(\d+|[IVXLCDM]+)\.\s*/im;
  return multilineArticleRegex.test(billText);
}

/**
 * Gets the total number of articles in a bill
 * @param billText - The full text of the bill
 * @returns Number of articles found
 */
export function countArticles(billText: string): number {
  return parseArticles(billText).length;
}

/**
 * Finds the article containing a specific section
 * @param articles - Array of parsed articles
 * @param sectionNumber - The section number to find (e.g., "1.05")
 * @returns The article containing the section, or undefined if not found
 */
export function findArticleForSection(
  articles: BillArticle[],
  sectionNumber: string
): BillArticle | undefined {
  return articles.find((article) => article.sections.includes(sectionNumber));
}
