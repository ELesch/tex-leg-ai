/**
 * Bill Complexity Detector
 *
 * Analyzes Texas legislative bill text to determine complexity level
 * and identify patterns like terminology replacements and omnibus bills.
 */

/** Complexity levels for Texas legislative bills */
export type BillComplexity = 'simple' | 'moderate' | 'complex' | 'omnibus';

/** Common bill patterns that can be detected */
export type BillPattern = 'terminology_replacement' | 'omnibus' | 'single_code' | null;

/** Result of complexity analysis */
export interface ComplexityResult {
  /** Overall complexity classification */
  complexity: BillComplexity;
  /** Detected pattern type if applicable */
  pattern: BillPattern;
  /** Number of ARTICLE sections (for omnibus bills) */
  articleCount: number;
  /** Number of SECTION entries */
  sectionCount: number;
  /** List of unique Texas codes affected */
  affectedCodes: string[];
  /** Details about terminology replacement if detected */
  terminologyReplacement?: {
    fromTerm: string;
    toTerm: string;
    occurrenceCount: number;
  };
}

/**
 * Regular expression to match SECTION declarations
 * Matches patterns like:
 * - "SECTION 1."
 * - "SECTION 1.01."
 * - "SECTION 12."
 */
const SECTION_REGEX = /^SECTION\s+(\d+(?:\.\d+)?)\./gm;

/**
 * Regular expression to match ARTICLE declarations
 * Matches patterns like:
 * - "ARTICLE 1."
 * - "ARTICLE I."
 * - "ARTICLE 1.  TITLE HERE"
 */
const ARTICLE_REGEX = /^ARTICLE\s+(\d+|[IVXLC]+)\.\s*/gm;

/**
 * Regular expression to extract Texas code names
 * Matches patterns like:
 * - "Education Code"
 * - "Government Code"
 * - "Health and Safety Code"
 * - "Tax Code"
 */
const CODE_NAME_REGEX = /(?:Section|Chapter|Subchapter|Title|Subtitle)\s+[\d.A-Z-]+(?:\([a-z0-9-]+\))*,?\s+([A-Za-z]+(?:\s+(?:and\s+)?[A-Za-z]+)*\s+Code)/gi;

/**
 * Common terminology replacement patterns in Texas bills
 * These represent standard term changes (e.g., renaming agencies, updating language)
 */
const TERMINOLOGY_PATTERNS = [
  // Common agency renamings
  { from: /Texas Education Agency/gi, to: 'Texas Education Agency' },
  // General "X is changed to Y" pattern
  {
    regex: /["']([^"']+)["']\s+(?:is|are)\s+(?:changed|replaced|substituted)\s+(?:to|with|by)\s+["']([^"']+)["']/gi,
    extract: true
  },
  // Struck through text replacement pattern
  {
    regex: /\[([^\]]+)\]\s*(?:is|are)?\s*(?:deleted|struck|removed).*?(?:and\s+)?(?:replaced|substituted)\s+(?:with|by)\s+["']?([^"'\n]+)["']?/gi,
    extract: true
  }
];

/**
 * Counts the number of sections in bill text
 * @param billText - The full text of the bill
 * @returns Number of SECTION declarations found
 */
function countSections(billText: string): number {
  const matches = billText.match(SECTION_REGEX);
  return matches ? matches.length : 0;
}

/**
 * Counts the number of articles in bill text
 * @param billText - The full text of the bill
 * @returns Number of ARTICLE declarations found
 */
function countArticles(billText: string): number {
  const matches = billText.match(ARTICLE_REGEX);
  return matches ? matches.length : 0;
}

/**
 * Extracts unique Texas code names from bill text
 * @param billText - The full text of the bill
 * @returns Array of unique code names (e.g., ["Education Code", "Government Code"])
 */
function extractAffectedCodes(billText: string): string[] {
  const codes = new Set<string>();
  let match;

  // Reset regex state
  const regex = new RegExp(CODE_NAME_REGEX.source, 'gi');

  while ((match = regex.exec(billText)) !== null) {
    const codeName = match[1].trim();
    // Normalize the code name (keep "and" lowercase for proper formatting)
    const normalized = codeName
      .split(/\s+/)
      .map(word => {
        if (word.toLowerCase() === 'and') return 'and';
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
    codes.add(normalized);
  }

  // Also look for standalone code references like "the Government Code"
  const standaloneCodeRegex = /the\s+([A-Za-z]+(?:\s+(?:and\s+)?[A-Za-z]+)*\s+Code)/g;
  while ((match = standaloneCodeRegex.exec(billText)) !== null) {
    const codeName = match[1].trim();
    // Normalize the code name (keep "and" lowercase for proper formatting)
    const normalized = codeName
      .split(/\s+/)
      .map(word => {
        if (word.toLowerCase() === 'and') return 'and';
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
    codes.add(normalized);
  }

  return Array.from(codes).sort();
}

/**
 * Detects terminology replacement patterns in bill text
 * @param billText - The full text of the bill
 * @returns Terminology replacement info if found, undefined otherwise
 */
function detectTerminologyReplacement(billText: string): ComplexityResult['terminologyReplacement'] | undefined {
  // Look for explicit "each reference to X means Y" or substitution patterns
  const substitutionPattern = /(?:each|every|all)\s+(?:reference|occurrence)s?\s+(?:to|of)\s+["']([^"']+)["']\s+(?:mean|means|is|are|shall\s+be)\s+(?:a\s+reference\s+to\s+)?["']([^"']+)["']/gi;

  let match = substitutionPattern.exec(billText);
  if (match) {
    // Count occurrences of the "from" term
    const fromTerm = match[1];
    const toTerm = match[2];
    const fromRegex = new RegExp(escapeRegExp(fromTerm), 'gi');
    const occurrences = (billText.match(fromRegex) || []).length;

    return {
      fromTerm,
      toTerm,
      occurrenceCount: occurrences
    };
  }

  // Look for "striking X and substituting Y" patterns
  const strikeSubstitutePattern = /striking\s+["']([^"']+)["']\s+(?:and\s+)?substituting\s+["']([^"']+)["']/gi;
  match = strikeSubstitutePattern.exec(billText);
  if (match) {
    const fromTerm = match[1];
    const toTerm = match[2];

    // Count how many times this substitution appears
    const patternRegex = new RegExp(
      `striking\\s+["']${escapeRegExp(fromTerm)}["']\\s+(?:and\\s+)?substituting\\s+["']${escapeRegExp(toTerm)}["']`,
      'gi'
    );
    const occurrences = (billText.match(patternRegex) || []).length;

    if (occurrences >= 3) {
      return {
        fromTerm,
        toTerm,
        occurrenceCount: occurrences
      };
    }
  }

  return undefined;
}

/**
 * Escapes special regex characters in a string
 * @param str - String to escape
 * @returns Escaped string safe for use in RegExp
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Determines the bill pattern based on analysis
 * @param articleCount - Number of articles
 * @param sectionCount - Number of sections
 * @param codeCount - Number of affected codes
 * @param hasTerminologyReplacement - Whether terminology replacement was detected
 * @returns The detected bill pattern
 */
function determinePattern(
  articleCount: number,
  sectionCount: number,
  codeCount: number,
  hasTerminologyReplacement: boolean
): BillPattern {
  if (hasTerminologyReplacement) {
    return 'terminology_replacement';
  }

  if (articleCount > 0 || sectionCount > 50) {
    return 'omnibus';
  }

  if (codeCount === 1) {
    return 'single_code';
  }

  return null;
}

/**
 * Determines the complexity level of a bill
 *
 * Complexity rules:
 * - simple: 1-3 sections, single code
 * - moderate: 4-10 sections, 1-2 codes
 * - complex: 11-50 sections or 3+ codes
 * - omnibus: 50+ sections or has ARTICLE structure
 *
 * @param sectionCount - Number of sections
 * @param articleCount - Number of articles
 * @param codeCount - Number of affected codes
 * @returns The complexity classification
 */
function determineComplexity(
  sectionCount: number,
  articleCount: number,
  codeCount: number
): BillComplexity {
  // Omnibus: Has ARTICLE structure or 50+ sections
  if (articleCount > 0 || sectionCount > 50) {
    return 'omnibus';
  }

  // Complex: 11-50 sections or 3+ codes
  if (sectionCount >= 11 || codeCount >= 3) {
    return 'complex';
  }

  // Moderate: 4-10 sections, 1-2 codes
  if (sectionCount >= 4 && sectionCount <= 10 && codeCount <= 2) {
    return 'moderate';
  }

  // Simple: 1-3 sections with single code (or up to 10 sections if single code)
  if (sectionCount <= 3 && codeCount <= 1) {
    return 'simple';
  }

  // Default to moderate for edge cases (e.g., 4-10 sections with 0 codes)
  if (sectionCount <= 10) {
    return 'moderate';
  }

  return 'complex';
}

/**
 * Analyzes bill text and returns complexity metrics
 *
 * This function examines the structure of a Texas legislative bill
 * and categorizes it by complexity, identifying patterns like
 * omnibus bills, terminology replacements, and single-code modifications.
 *
 * @param billText - The full text of the bill to analyze
 * @returns ComplexityResult with detailed metrics
 *
 * @example
 * ```typescript
 * const result = detectComplexity(billText);
 * console.log(result.complexity); // 'simple' | 'moderate' | 'complex' | 'omnibus'
 * console.log(result.affectedCodes); // ['Education Code', 'Government Code']
 * ```
 */
export function detectComplexity(billText: string): ComplexityResult {
  // Handle empty or invalid input
  if (!billText || typeof billText !== 'string') {
    return {
      complexity: 'simple',
      pattern: null,
      articleCount: 0,
      sectionCount: 0,
      affectedCodes: []
    };
  }

  const sectionCount = countSections(billText);
  const articleCount = countArticles(billText);
  const affectedCodes = extractAffectedCodes(billText);
  const terminologyReplacement = detectTerminologyReplacement(billText);

  const complexity = determineComplexity(sectionCount, articleCount, affectedCodes.length);
  const pattern = determinePattern(
    articleCount,
    sectionCount,
    affectedCodes.length,
    !!terminologyReplacement
  );

  const result: ComplexityResult = {
    complexity,
    pattern,
    articleCount,
    sectionCount,
    affectedCodes
  };

  if (terminologyReplacement) {
    result.terminologyReplacement = terminologyReplacement;
  }

  return result;
}
