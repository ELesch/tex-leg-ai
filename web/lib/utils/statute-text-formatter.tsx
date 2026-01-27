'use client';

import React from 'react';

// HTML entities that need to be decoded
const HTML_ENTITIES: Record<string, string> = {
  '&ldquo;': '"',
  '&rdquo;': '"',
  '&lsquo;': "'",
  '&rsquo;': "'",
  '&mdash;': '—',
  '&ndash;': '–',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
  '&sect;': '§',
  '&copy;': '©',
  '&reg;': '®',
  '&deg;': '°',
  '&frac12;': '½',
  '&frac14;': '¼',
  '&frac34;': '¾',
  '&#xA0;': ' ',
  '&#x27;': "'",
  '&#39;': "'",
  '&#34;': '"',
  '&#x22;': '"',
};

// Also handle escaped versions like \&ldquo;
const ESCAPED_ENTITY_PATTERN = /\\&([a-zA-Z0-9#]+);/g;
const ENTITY_PATTERN = /&([a-zA-Z0-9#]+);/g;

/**
 * Decode HTML entities in text
 */
export function decodeHtmlEntities(text: string): string {
  let result = text;

  // First handle escaped entities like \&ldquo;
  result = result.replace(ESCAPED_ENTITY_PATTERN, (match) => {
    const unescaped = match.slice(1); // Remove the backslash
    return HTML_ENTITIES[unescaped] || unescaped;
  });

  // Then handle regular entities
  result = result.replace(ENTITY_PATTERN, (match) => {
    return HTML_ENTITIES[match] || match;
  });

  return result;
}

// Patterns for revision history that can be hidden
const REVISION_PATTERNS = [
  /Added by Acts \d{4}.*?(?=\n|$)/g,
  /Amended by Acts \d{4}.*?(?=\n|$)/g,
  /Redesignated from.*?(?=\n|$)/g,
  /Renumbered from.*?(?=\n|$)/g,
  /Text of.*?(?=\n|$)/g,
];

/**
 * Filter out revision history annotations from statute text
 */
export function filterRevisionHistory(content: string): string {
  let filtered = content;
  for (const pattern of REVISION_PATTERNS) {
    filtered = filtered.replace(pattern, '');
  }
  return filtered.replace(/\n{3,}/g, '\n\n');
}

/**
 * Determine indent level based on subsection markers
 *
 * Texas statute subsection hierarchy:
 * - (a), (b), (c), (a-1), (g-1) = level 1 (lowercase letter, optionally with number suffix)
 * - (1), (2), (3), (1-a), (2-b) = level 2 (number, optionally with letter suffix)
 * - (A), (B), (C), (A-1)        = level 3 (uppercase letter)
 * - (i), (ii), (iii), (iv)      = level 4 (roman numerals)
 */
export function getIndentLevel(line: string): number {
  const trimmed = line.trim();

  // (a), (b), (a-1), (g-1), etc. - lowercase letter with optional -number suffix
  if (/^\([a-z](?:-\d+)?\)/.test(trimmed)) return 1;

  // (1), (2), (1-a), (2-b), etc. - number with optional -letter suffix
  if (/^\(\d+(?:-[a-z])?\)/.test(trimmed)) return 2;

  // (A), (B), (A-1), etc. - uppercase letter with optional -number suffix
  if (/^\([A-Z](?:-\d+)?\)/.test(trimmed)) return 3;

  // (i), (ii), (iii), (iv), (v), (vi), (vii), (viii), (ix), (x), etc. - roman numerals
  // Note: This must come after lowercase letters to avoid matching (i) incorrectly
  // We check for multi-character roman numerals or single 'i' followed by end/space/punctuation
  if (/^\((?:i{1,3}|iv|vi{0,3}|ix|x{1,3}|xi{1,3}|xiv|xv{1,3}|xix|xx)\)/i.test(trimmed)) {
    // Only treat as roman numeral if it looks like one (single 'i' could be a letter)
    // Check if it's likely a roman numeral by context (usually follows a pattern)
    const match = trimmed.match(/^\(([ivxlcdm]+)\)/i);
    if (match) {
      const potential = match[1].toLowerCase();
      // Multi-char is definitely roman numeral, single 'i' we treat as roman numeral at level 4
      if (potential.length > 1 || potential === 'i') {
        return 4;
      }
    }
  }

  return 0;
}

interface RenderIndentedTextOptions {
  hideRevisionHistory?: boolean;
}

/**
 * Render statute text with proper indentation for subsection markers
 */
export function renderIndentedText(
  text: string,
  options: RenderIndentedTextOptions = {}
): React.ReactNode {
  const { hideRevisionHistory = false } = options;

  // Decode HTML entities first
  let processedText = decodeHtmlEntities(text);

  // Filter revision history if requested
  if (hideRevisionHistory) {
    processedText = filterRevisionHistory(processedText);
  }

  const lines = processedText.split('\n');

  return lines.map((line, i) => {
    const indent = getIndentLevel(line);
    return (
      <div
        key={i}
        className="leading-relaxed"
        style={{ marginLeft: indent > 0 ? `${indent * 1.5}rem` : undefined }}
      >
        {line || '\u00A0'}
      </div>
    );
  });
}
