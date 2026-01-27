/**
 * Texas Codes Reference
 * List of all Texas statutory codes with their abbreviations and full names.
 * Used for syncing statutes from https://statutes.capitol.texas.gov/
 */

export const TEXAS_CODES = [
  { abbreviation: 'AG', name: 'Agriculture Code' },
  { abbreviation: 'AL', name: 'Alcoholic Beverage Code' },
  { abbreviation: 'BC', name: 'Business and Commerce Code' },
  { abbreviation: 'BO', name: 'Business Organizations Code' },
  { abbreviation: 'CP', name: 'Civil Practice and Remedies Code' },
  { abbreviation: 'CR', name: 'Code of Criminal Procedure' },
  { abbreviation: 'ED', name: 'Education Code' },
  { abbreviation: 'EL', name: 'Election Code' },
  { abbreviation: 'ES', name: 'Estates Code' },
  { abbreviation: 'FA', name: 'Family Code' },
  { abbreviation: 'FI', name: 'Finance Code' },
  { abbreviation: 'GV', name: 'Government Code' },
  { abbreviation: 'HS', name: 'Health and Safety Code' },
  { abbreviation: 'HR', name: 'Human Resources Code' },
  { abbreviation: 'IN', name: 'Insurance Code' },
  { abbreviation: 'LA', name: 'Labor Code' },
  { abbreviation: 'LG', name: 'Local Government Code' },
  { abbreviation: 'NR', name: 'Natural Resources Code' },
  { abbreviation: 'OC', name: 'Occupations Code' },
  { abbreviation: 'PE', name: 'Penal Code' },
  { abbreviation: 'PW', name: 'Parks and Wildlife Code' },
  { abbreviation: 'PR', name: 'Property Code' },
  { abbreviation: 'SD', name: 'Special District Local Laws Code' },
  { abbreviation: 'TX', name: 'Tax Code' },
  { abbreviation: 'TN', name: 'Transportation Code' },
  { abbreviation: 'UT', name: 'Utilities Code' },
  { abbreviation: 'WA', name: 'Water Code' },
] as const;

export type TexasCodeAbbreviation = typeof TEXAS_CODES[number]['abbreviation'];
export type TexasCodeName = typeof TEXAS_CODES[number]['name'];

/**
 * Get the full name for a code abbreviation
 */
export function getCodeName(abbreviation: string): string | undefined {
  const code = TEXAS_CODES.find(c => c.abbreviation === abbreviation.toUpperCase());
  return code?.name;
}

/**
 * Get the abbreviation for a code name
 */
export function getCodeAbbreviation(name: string): string | undefined {
  const code = TEXAS_CODES.find(c =>
    c.name.toLowerCase() === name.toLowerCase() ||
    c.name.toLowerCase().replace(' code', '') === name.toLowerCase().replace(' code', '')
  );
  return code?.abbreviation;
}

/**
 * Check if a string is a valid Texas code abbreviation
 */
export function isValidCodeAbbreviation(abbr: string): abbr is TexasCodeAbbreviation {
  return TEXAS_CODES.some(c => c.abbreviation === abbr.toUpperCase());
}

/**
 * URL for fetching statute chapter HTML from Texas Legislature website
 * Example: https://statutes.capitol.texas.gov/Docs/ED/htm/ED.29.htm
 */
export function getChapterUrl(codeAbbreviation: string, chapterNum: string): string {
  const abbr = codeAbbreviation.toUpperCase();
  return `https://statutes.capitol.texas.gov/Docs/${abbr}/htm/${abbr}.${chapterNum}.htm`;
}

/**
 * URL for the code's table of contents page
 */
export function getCodeTocUrl(codeAbbreviation: string): string {
  const abbr = codeAbbreviation.toUpperCase();
  return `https://statutes.capitol.texas.gov/Docs/${abbr}/htm/${abbr}.htm`;
}
