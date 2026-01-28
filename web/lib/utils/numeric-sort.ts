/**
 * Numeric sorting utilities for chapters and sections
 *
 * These utilities sort items numerically (1, 2, 10, 11) instead of
 * alphanumerically (1, 10, 11, 2).
 */

/**
 * Compare two strings numerically based on their leading numbers.
 * Falls back to lexicographic comparison if numbers are equal or not present.
 */
export function numericCompare(a: string, b: string): number {
  // Extract leading number from each string
  const numA = parseFloat(a.match(/^[\d.]+/)?.[0] || '0');
  const numB = parseFloat(b.match(/^[\d.]+/)?.[0] || '0');

  // If numbers are different, sort by number
  if (numA !== numB) return numA - numB;

  // Otherwise fall back to string comparison
  return a.localeCompare(b);
}

/**
 * Sort an array of items with chapterNum property numerically.
 */
export function sortChaptersNumerically<T extends { chapterNum: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => numericCompare(a.chapterNum, b.chapterNum));
}

/**
 * Sort an array of items with sectionNum property numerically.
 * Handles dotted section numbers like "29.001", "29.0011", "29.002".
 */
export function sortSectionsNumerically<T extends { sectionNum: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    // Split by dots and convert to numbers
    const partsA = a.sectionNum.split('.').map(p => parseFloat(p) || 0);
    const partsB = b.sectionNum.split('.').map(p => parseFloat(p) || 0);

    // Compare each part numerically
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const diff = (partsA[i] || 0) - (partsB[i] || 0);
      if (diff !== 0) return diff;
    }

    // If all parts equal, use string comparison as tiebreaker
    return a.sectionNum.localeCompare(b.sectionNum);
  });
}

/**
 * Sort an array of items with a subchapter property alphabetically.
 * Subchapters are typically A, B, C etc. or A-1, A-2, etc.
 */
export function sortSubchaptersNumerically<T extends { subchapter: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => subchapterCompare(a.subchapter || '', b.subchapter || ''));
}

/**
 * Compare two subchapter values.
 * Handles cases like "A" vs "B" and "A-1" vs "A-2".
 */
export function subchapterCompare(a: string, b: string): number {
  // Handle cases like "A-1" vs "A-2" vs "B"
  const matchA = a.match(/^([A-Z]+)(?:-(\d+))?$/);
  const matchB = b.match(/^([A-Z]+)(?:-(\d+))?$/);

  if (matchA && matchB) {
    // Compare letters first
    const letterCompare = matchA[1].localeCompare(matchB[1]);
    if (letterCompare !== 0) return letterCompare;

    // Then compare numbers if present
    const numA = parseInt(matchA[2] || '0', 10);
    const numB = parseInt(matchB[2] || '0', 10);
    return numA - numB;
  }

  // Fall back to string comparison
  return a.localeCompare(b);
}

/**
 * Compare two section number strings numerically.
 * Handles dotted section numbers like "29.001", "29.0011", "29.002".
 */
export function sectionNumCompare(a: string, b: string): number {
  // Split by dots and convert to numbers
  const partsA = a.split('.').map(p => parseFloat(p) || 0);
  const partsB = b.split('.').map(p => parseFloat(p) || 0);

  // Compare each part numerically
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff !== 0) return diff;
  }

  // If all parts equal, use string comparison as tiebreaker
  return a.localeCompare(b);
}
