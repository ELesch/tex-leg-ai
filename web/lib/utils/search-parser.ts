/**
 * Parse search query with AND, OR, NOT operators
 * Returns Prisma-compatible filter conditions
 *
 * Examples:
 *   "education" -> contains "education" in billId or description
 *   "education AND funding" -> contains both terms
 *   "education OR schools" -> contains either term
 *   "education NOT tax" -> contains "education" but not "tax"
 *   "HB 123" -> matches bill ID
 */
export function parseSearchQuery(query: string): any[] {
  const conditions: any[] = [];

  // Trim and check for empty query
  query = query.trim();
  if (!query) return conditions;

  // Check if it's a bill ID pattern (e.g., "HB 123", "SB 45")
  const billIdMatch = query.match(/^(HB|SB|HJR|SJR|HCR|SCR)\s*(\d+)$/i);
  if (billIdMatch) {
    return [
      {
        billId: {
          equals: `${billIdMatch[1].toUpperCase()} ${parseInt(billIdMatch[2])}`,
          mode: 'insensitive',
        },
      },
    ];
  }

  // Split by AND, OR, NOT operators
  // Handle NOT first (it's a modifier, not a joiner)
  const notParts = query.split(/\s+NOT\s+/i);
  const mainQuery = notParts[0];
  const notTerms = notParts.slice(1);

  // Process main query (AND/OR)
  if (mainQuery.includes(' AND ') || mainQuery.toUpperCase().includes(' AND ')) {
    // AND query - all terms must match
    const andTerms = mainQuery.split(/\s+AND\s+/i).map((t) => t.trim()).filter(Boolean);

    for (const term of andTerms) {
      conditions.push({
        OR: [
          { billId: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
        ],
      });
    }
  } else if (mainQuery.includes(' OR ') || mainQuery.toUpperCase().includes(' OR ')) {
    // OR query - any term can match
    const orTerms = mainQuery.split(/\s+OR\s+/i).map((t) => t.trim()).filter(Boolean);

    const orConditions = orTerms.map((term) => ({
      OR: [
        { billId: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ],
    }));

    conditions.push({ OR: orConditions });
  } else {
    // Simple search - single term
    conditions.push({
      OR: [
        { billId: { contains: mainQuery, mode: 'insensitive' } },
        { description: { contains: mainQuery, mode: 'insensitive' } },
      ],
    });
  }

  // Add NOT conditions (exclusions)
  for (const notTerm of notTerms) {
    const term = notTerm.trim();
    if (term) {
      conditions.push({
        AND: [
          { billId: { not: { contains: term }, mode: 'insensitive' } },
          { description: { not: { contains: term }, mode: 'insensitive' } },
        ],
      });
    }
  }

  return conditions;
}

/**
 * Highlight search terms in text
 */
export function highlightSearchTerms(text: string, query: string): string {
  if (!query) return text;

  // Extract search terms (ignore operators)
  const terms = query
    .replace(/\s+(AND|OR|NOT)\s+/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);

  let result = text;
  for (const term of terms) {
    const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
    result = result.replace(regex, '<mark>$1</mark>');
  }

  return result;
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
