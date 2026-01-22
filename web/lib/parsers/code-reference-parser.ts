/**
 * Code Reference Parser
 *
 * Parses Texas legislative bill text to extract references to Texas codes
 * and identifies the type of action being taken (add, amend, repeal).
 */

/** A reference to a specific Texas code section with amendment details */
export interface CodeReference {
  /** The Texas code being modified (e.g., "Education Code") */
  code: string;
  /** Title number if specified (e.g., "Title 2") */
  title?: string;
  /** Subtitle letter if specified (e.g., "Subtitle A") */
  subtitle?: string;
  /** Chapter number (e.g., "Chapter 29") */
  chapter?: string;
  /** Subchapter letter or name (e.g., "Subchapter Z") */
  subchapter?: string;
  /** Section number (e.g., "29.914" or "29.914(a)") */
  section: string;
  /** Specific subsections being modified (e.g., ["(a)", "(b-1)"]) */
  subsections?: string[];
  /** The type of modification */
  action: 'add' | 'amend' | 'repeal';
  /** The bill section containing this reference (e.g., "SECTION 1" or "SECTION 1.01") */
  billSection: string;
  /** Original matched text for debugging */
  rawText: string;
}

/**
 * Pattern to extract the current bill section number
 * Matches "SECTION X." or "SECTION X.XX."
 */
const BILL_SECTION_REGEX = /^SECTION\s+(\d+(?:\.\d+)?)\./;

/**
 * Pattern to match section references with code names
 * Capture groups:
 * - [1]: The section number (e.g., "29.914", "48.101(b)", "12A.004")
 * - [2]: The code name (e.g., "Education Code", "Health and Safety Code")
 */
const SECTION_CODE_REGEX = /Section\s+([\dA-Z.]+(?:\([a-z0-9-]+\))?(?:\s+or\s+\([a-z0-9-]+\))*),\s+([A-Za-z]+(?:\s+(?:and\s+)?[A-Za-z]+)*\s+Code)/gi;

/**
 * Pattern to match chapter/subchapter references
 * Capture groups:
 * - [1]: type (Subchapter or Chapter)
 * - [2]: number
 * - [3]: chapterNum (optional, for subchapter refs)
 * - [4]: code name
 */
const CHAPTER_SUBCHAPTER_REGEX = /(Subchapter|Chapter)\s+([\dA-Z]+),\s+(?:Chapter\s+(\d+),\s+)?([A-Za-z]+(?:\s+(?:and\s+)?[A-Za-z]+)*\s+Code)/gi;

/**
 * Pattern to match title/subtitle references
 * Capture groups:
 * - [1]: type (Title or Subtitle)
 * - [2]: number
 * - [3]: code name
 */
const TITLE_SUBTITLE_REGEX = /(Title|Subtitle)\s+([\dA-Z]+),\s+([A-Za-z]+(?:\s+(?:and\s+)?[A-Za-z]+)*\s+Code)/gi;

/**
 * Patterns to detect the type of action being taken
 */
const ACTION_PATTERNS = {
  add: [
    /is\s+amended\s+by\s+adding\s+(?:Section|Sections|Chapter|Subchapter)/i,
    /is\s+added\s+to\s+read\s+as\s+follows/i,
    /is\s+amended\s+by\s+adding\s+(?:Subsection|Subsections)/i,
    /is\s+amended\s+by\s+adding\s+(?:Subdivision|Subdivisions)/i,
  ],
  repeal: [
    /is\s+repealed/i,
    /are\s+repealed/i,
  ],
  amend: [
    /is\s+amended\s+to\s+read\s+as\s+follows/i,
    /are\s+amended\s+to\s+read\s+as\s+follows/i,
    /is\s+amended\s+by\s+amending/i,
    /is\s+amended\s+by\s+adding\s+and\s+amending/i,
    /is\s+amended/i,
  ],
};

/**
 * Pattern to extract subsections from section references
 * Matches: (a), (b-1), (a-2), etc.
 */
const SUBSECTION_REGEX = /\(([a-z](?:-\d+)?)\)/gi;

/**
 * Pattern to match sections with "amending Subsections (a) and (b)" style
 */
const AMENDING_SUBSECTIONS_REGEX = /amending\s+Subsections?\s+\(([a-z](?:-\d+)?)\)(?:\s*(?:,|and)\s*\(([a-z](?:-\d+)?)\))*/gi;

/**
 * Detects the action type from the context around a code reference
 * @param context - Text surrounding the code reference
 * @returns The detected action type
 */
function detectAction(context: string): 'add' | 'amend' | 'repeal' {
  // Check for add patterns first (most specific)
  for (const pattern of ACTION_PATTERNS.add) {
    if (pattern.test(context)) {
      return 'add';
    }
  }

  // Check for repeal patterns
  for (const pattern of ACTION_PATTERNS.repeal) {
    if (pattern.test(context)) {
      return 'repeal';
    }
  }

  // Default to amend (most common action)
  for (const pattern of ACTION_PATTERNS.amend) {
    if (pattern.test(context)) {
      return 'amend';
    }
  }

  return 'amend';
}

/**
 * Extracts subsections from a section reference string
 * @param text - Text containing subsection references
 * @returns Array of subsection identifiers
 */
function extractSubsections(text: string): string[] | undefined {
  const subsections: string[] = [];
  let match;

  // Extract from section number itself (e.g., "29.914(a)")
  const sectionSubsectionRegex = /\(([a-z](?:-\d+)?)\)/gi;
  while ((match = sectionSubsectionRegex.exec(text)) !== null) {
    const subsection = `(${match[1]})`;
    if (!subsections.includes(subsection)) {
      subsections.push(subsection);
    }
  }

  // Extract from "or (b)" patterns
  const orSubsectionRegex = /\s+or\s+\(([a-z](?:-\d+)?)\)/gi;
  while ((match = orSubsectionRegex.exec(text)) !== null) {
    const subsection = `(${match[1]})`;
    if (!subsections.includes(subsection)) {
      subsections.push(subsection);
    }
  }

  return subsections.length > 0 ? subsections : undefined;
}

/**
 * Extracts subsections mentioned in "amending Subsections (a) and (b)" patterns
 * @param context - Text to search
 * @returns Array of subsection identifiers
 */
function extractAmendingSubsections(context: string): string[] {
  const subsections: string[] = [];
  const regex = /amending\s+Subsections?\s+([^,\n]+)/gi;
  let match;

  while ((match = regex.exec(context)) !== null) {
    const subsectionText = match[1];
    const subRegex = /\(([a-z](?:-\d+)?)\)/gi;
    let subMatch;
    while ((subMatch = subRegex.exec(subsectionText)) !== null) {
      const subsection = `(${subMatch[1]})`;
      if (!subsections.includes(subsection)) {
        subsections.push(subsection);
      }
    }
  }

  return subsections;
}

/**
 * Extracts the base section number without subsection qualifiers
 * @param section - Section string that may include subsections
 * @returns Clean section number
 */
function extractBaseSection(section: string): string {
  // Handle "Sections 48.101(b) or (c)" style - just return the base with first subsection
  return section.split(/\s+or\s+/)[0].trim();
}

/**
 * Normalizes code name for consistent output
 * @param code - Raw code name
 * @returns Normalized code name
 */
function normalizeCodeName(code: string): string {
  return code
    .split(/\s+/)
    .map(word => {
      // Keep "and" lowercase
      if (word.toLowerCase() === 'and') return 'and';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Parses a single bill section to extract code references
 * @param sectionText - Text of a single bill section
 * @param billSection - The bill section identifier (e.g., "1" or "1.01")
 * @returns Array of code references found in the section
 */
function parseSectionReferences(sectionText: string, billSection: string): CodeReference[] {
  const references: CodeReference[] = [];

  // Parse section references (most common)
  let match;
  const sectionRegex = new RegExp(SECTION_CODE_REGEX.source, 'gi');

  while ((match = sectionRegex.exec(sectionText)) !== null) {
    const section = match[1];
    const code = match[2];
    const rawText = match[0];

    // Get context for action detection (text around the match)
    const contextStart = Math.max(0, match.index - 20);
    const contextEnd = Math.min(sectionText.length, match.index + rawText.length + 100);
    const context = sectionText.slice(contextStart, contextEnd);

    const action = detectAction(context);

    // Extract subsections from the section reference
    let subsections = extractSubsections(rawText);

    // Also check for "amending Subsections" pattern
    const amendingSubsections = extractAmendingSubsections(context);
    if (amendingSubsections.length > 0) {
      subsections = subsections
        ? Array.from(new Set([...subsections, ...amendingSubsections]))
        : amendingSubsections;
    }

    // Extract chapter from section number (e.g., "29.914" -> "Chapter 29")
    const sectionNum = extractBaseSection(section);
    const chapterMatch = sectionNum.match(/^(\d+)\./);
    const chapter = chapterMatch ? `Chapter ${chapterMatch[1]}` : undefined;

    references.push({
      code: normalizeCodeName(code),
      section: sectionNum,
      subsections,
      action,
      billSection: `SECTION ${billSection}`,
      rawText,
      ...(chapter && { chapter }),
    });
  }

  // Parse chapter/subchapter references
  const chapterRegex = new RegExp(CHAPTER_SUBCHAPTER_REGEX.source, 'gi');
  while ((match = chapterRegex.exec(sectionText)) !== null) {
    const type = match[1];
    const number = match[2];
    const chapterNum = match[3];  // May be undefined
    const code = match[4];
    const rawText = match[0];

    // Get context for action detection
    const contextStart = Math.max(0, match.index - 20);
    const contextEnd = Math.min(sectionText.length, match.index + rawText.length + 100);
    const context = sectionText.slice(contextStart, contextEnd);

    const action = detectAction(context);

    const ref: CodeReference = {
      code: normalizeCodeName(code),
      section: `${type} ${number}`,
      action,
      billSection: `SECTION ${billSection}`,
      rawText,
    };

    if (type.toLowerCase() === 'subchapter') {
      ref.subchapter = `Subchapter ${number}`;
      if (chapterNum) {
        ref.chapter = `Chapter ${chapterNum}`;
      }
    } else {
      ref.chapter = `Chapter ${number}`;
    }

    references.push(ref);
  }

  // Parse title/subtitle references
  const titleRegex = new RegExp(TITLE_SUBTITLE_REGEX.source, 'gi');
  while ((match = titleRegex.exec(sectionText)) !== null) {
    const type = match[1];
    const number = match[2];
    const code = match[3];
    const rawText = match[0];

    // Get context for action detection
    const contextStart = Math.max(0, match.index - 20);
    const contextEnd = Math.min(sectionText.length, match.index + rawText.length + 100);
    const context = sectionText.slice(contextStart, contextEnd);

    const action = detectAction(context);

    const ref: CodeReference = {
      code: normalizeCodeName(code),
      section: `${type} ${number}`,
      action,
      billSection: `SECTION ${billSection}`,
      rawText,
    };

    if (type.toLowerCase() === 'title') {
      ref.title = `Title ${number}`;
    } else {
      ref.subtitle = `Subtitle ${number}`;
    }

    references.push(ref);
  }

  return references;
}

/**
 * Parses bill text to extract all code references
 *
 * This function scans through Texas legislative bill text and extracts
 * references to specific Texas codes, identifying:
 * - Which code is being modified
 * - Which section/chapter/subchapter
 * - What type of modification (add, amend, repeal)
 * - Which bill section contains the reference
 *
 * @param billText - The full text of the bill
 * @returns Array of code references found, or empty array if none found
 *
 * @example
 * ```typescript
 * const refs = parseCodeReferences(billText);
 * // Returns:
 * // [
 * //   {
 * //     code: "Education Code",
 * //     section: "29.914",
 * //     action: "amend",
 * //     billSection: "SECTION 1",
 * //     rawText: "Section 29.914, Education Code"
 * //   }
 * // ]
 * ```
 */
export function parseCodeReferences(billText: string): CodeReference[] {
  // Handle empty or invalid input
  if (!billText || typeof billText !== 'string') {
    return [];
  }

  const references: CodeReference[] = [];

  // Split bill into sections
  const lines = billText.split('\n');
  let currentSection = '';
  let currentSectionText = '';

  for (const line of lines) {
    const sectionMatch = line.match(BILL_SECTION_REGEX);

    if (sectionMatch) {
      // Process previous section if exists
      if (currentSection && currentSectionText) {
        const sectionRefs = parseSectionReferences(currentSectionText, currentSection);
        references.push(...sectionRefs);
      }

      // Start new section
      currentSection = sectionMatch[1];
      currentSectionText = line;
    } else if (currentSection) {
      // Continue accumulating current section
      currentSectionText += '\n' + line;
    }
  }

  // Process last section
  if (currentSection && currentSectionText) {
    const sectionRefs = parseSectionReferences(currentSectionText, currentSection);
    references.push(...sectionRefs);
  }

  // If no sections found, try to parse the entire text
  if (references.length === 0 && billText.trim()) {
    const wholeTextRefs = parseSectionReferences(billText, '1');
    if (wholeTextRefs.length > 0) {
      // Update bill section to indicate unknown
      wholeTextRefs.forEach(ref => {
        ref.billSection = 'SECTION 1';
      });
      references.push(...wholeTextRefs);
    }
  }

  return references;
}
