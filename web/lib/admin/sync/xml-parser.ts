/**
 * XML Parser for Texas Legislature bill history files
 *
 * Parses XML like:
 * <billhistory bill="89(R) HB 1" lastUpdate="3/20/2025">
 *   <caption>General Appropriations Bill.</caption>
 *   <authors>Bonnen</authors>
 *   <coauthors>Kitzman | Lopez, Janie</coauthors>
 *   <sponsors/>
 *   <cosponsors/>
 *   <subjects>
 *     <subject>State Finances--Appropriations (I0746)</subject>
 *   </subjects>
 *   <lastaction>02/25/2025 H Referred to Appropriations</lastaction>
 *   <committees>
 *     <house name="Appropriations" status="In committee"/>
 *   </committees>
 *   <actions>
 *     <action>
 *       <date>1/22/2025</date>
 *       <description>Filed</description>
 *     </action>
 *   </actions>
 *   <billtext>
 *     <WebHTMLURL>http://capitol.texas.gov/tlodocs/89R/billtext/html/HB00001I.HTM</WebHTMLURL>
 *   </billtext>
 * </billhistory>
 */

import { BillType } from '@prisma/client';

export interface ParsedAction {
  date: string;
  description: string;
}

export interface ParsedCommittee {
  chamber: 'house' | 'senate';
  name: string;
  status: string;
}

export interface ParsedBill {
  billId: string;           // "HB 1"
  billType: BillType;       // HB, SB
  billNumber: number;       // 1
  description: string;      // from <caption>
  authors: string[];        // from <authors>
  coauthors: string[];      // from <coauthors>
  sponsors: string[];       // from <sponsors>
  cosponsors: string[];     // from <cosponsors>
  subjects: string[];       // from <subjects>
  status: string;           // derived from actions and committees
  lastAction: string;       // from <lastaction>
  lastActionDate: Date | null;
  lastUpdate: Date | null;  // from lastUpdate attribute
  textUrl: string | null;   // from <billtext><WebHTMLURL>
  committees: ParsedCommittee[];
  actions: ParsedAction[];
}

/**
 * Extract text content from an XML element
 * Handles CDATA and HTML entities
 */
function extractText(xml: string, tagName: string): string {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(pattern);
  if (!match) return '';

  const text = match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();

  return text;
}

/**
 * Extract an attribute value from an XML element
 */
function extractAttribute(xml: string, tagName: string, attrName: string): string | null {
  const pattern = new RegExp(`<${tagName}[^>]*\\s${attrName}="([^"]*)"`, 'i');
  const match = xml.match(pattern);
  return match ? match[1] : null;
}

/**
 * Parse a pipe-separated list of names (e.g., "Smith | Jones | Williams")
 */
function parseNameList(text: string): string[] {
  if (!text) return [];
  return text
    .split('|')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

/**
 * Parse all subjects from the XML
 */
function parseSubjects(xml: string): string[] {
  const subjects: string[] = [];
  const pattern = /<subject>([^<]*)<\/subject>/gi;
  let match;
  while ((match = pattern.exec(xml)) !== null) {
    const subject = match[1].trim();
    if (subject) {
      // Remove the code in parentheses, e.g., "State Finances--Appropriations (I0746)" -> "State Finances--Appropriations"
      const cleanSubject = subject.replace(/\s*\([^)]+\)\s*$/, '').trim();
      if (cleanSubject) {
        subjects.push(cleanSubject);
      }
    }
  }
  return subjects;
}

/**
 * Parse all actions from the XML
 */
function parseActions(xml: string): ParsedAction[] {
  const actions: ParsedAction[] = [];
  const actionsMatch = xml.match(/<actions>([\s\S]*?)<\/actions>/i);
  if (!actionsMatch) return actions;

  const actionsXml = actionsMatch[1];
  const pattern = /<action>([\s\S]*?)<\/action>/gi;
  let match;
  while ((match = pattern.exec(actionsXml)) !== null) {
    const actionXml = match[1];
    const date = extractText(actionXml, 'date');
    const description = extractText(actionXml, 'description');
    if (date && description) {
      actions.push({ date, description });
    }
  }

  return actions;
}

/**
 * Parse all committees from the XML
 */
function parseCommittees(xml: string): ParsedCommittee[] {
  const committees: ParsedCommittee[] = [];
  const committeesMatch = xml.match(/<committees>([\s\S]*?)<\/committees>/i);
  if (!committeesMatch) return committees;

  const committeesXml = committeesMatch[1];

  // House committees
  const housePattern = /<house\s+name="([^"]*)"\s+status="([^"]*)"/gi;
  let match;
  while ((match = housePattern.exec(committeesXml)) !== null) {
    committees.push({
      chamber: 'house',
      name: match[1],
      status: match[2],
    });
  }

  // Senate committees
  const senatePattern = /<senate\s+name="([^"]*)"\s+status="([^"]*)"/gi;
  while ((match = senatePattern.exec(committeesXml)) !== null) {
    committees.push({
      chamber: 'senate',
      name: match[1],
      status: match[2],
    });
  }

  return committees;
}

/**
 * Extract the bill text URL from the XML
 */
function parseTextUrl(xml: string): string | null {
  // Try WebHTMLURL first (preferred)
  const htmlUrl = extractText(xml, 'WebHTMLURL');
  if (htmlUrl && htmlUrl.startsWith('http')) {
    return htmlUrl;
  }

  // Fallback to other URL fields
  const webUrl = extractText(xml, 'WebURL');
  if (webUrl && webUrl.startsWith('http')) {
    return webUrl;
  }

  return null;
}

/**
 * Parse a date string in various formats
 * Handles: "3/20/2025", "03/20/2025", "1/22/2025"
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Try MM/DD/YYYY or M/D/YYYY format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  // Fallback to Date.parse
  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed)) {
    return new Date(parsed);
  }

  return null;
}

/**
 * Derive bill status from actions and committees
 */
function deriveStatus(actions: ParsedAction[], committees: ParsedCommittee[]): string {
  if (actions.length === 0) {
    return 'Filed';
  }

  // Check actions from most recent to oldest
  const reversedActions = [...actions].reverse();

  for (const action of reversedActions) {
    const desc = action.description.toLowerCase();

    if (desc.includes('signed by the governor') || desc.includes('effective')) {
      return 'Signed';
    }
    if (desc.includes('sent to the governor')) {
      return 'Sent to Governor';
    }
    if (desc.includes('enrolled')) {
      return 'Enrolled';
    }
    if (desc.includes('passed') && desc.includes('senate') && desc.includes('house')) {
      return 'Passed Both Chambers';
    }
    if (desc.includes('passed to engrossment')) {
      return 'Passed';
    }
    if (desc.includes('passed')) {
      return 'Passed';
    }
    if (desc.includes('vetoed')) {
      return 'Vetoed';
    }
    if (desc.includes('withdrawn') || desc.includes('died')) {
      return 'Dead';
    }
  }

  // Check committee status
  for (const committee of committees) {
    if (committee.status.toLowerCase() === 'in committee') {
      return 'In Committee';
    }
    if (committee.status.toLowerCase() === 'reported') {
      return 'Reported';
    }
  }

  // Check if referred to committee
  for (const action of actions) {
    if (action.description.toLowerCase().includes('referred to')) {
      return 'In Committee';
    }
  }

  return 'Filed';
}

/**
 * Extract last action date from <lastaction> text
 * Format: "02/25/2025 H Referred to Appropriations"
 */
function parseLastActionDate(lastAction: string): Date | null {
  if (!lastAction) return null;

  // Look for date at the beginning
  const match = lastAction.match(/^(\d{1,2}\/\d{1,2}\/\d{4})/);
  if (match) {
    return parseDate(match[1]);
  }

  return null;
}

/**
 * Parse bill XML content into structured data
 * Returns null if XML is invalid or missing required data
 */
export function parseBillXml(xml: string): ParsedBill | null {
  if (!xml) return null;

  // Check for valid XML
  if (!xml.includes('<billhistory') && !xml.includes('<BillHistory')) {
    return null;
  }

  // Extract bill ID from attribute: bill="89(R) HB 1"
  const billAttr = extractAttribute(xml, 'billhistory', 'bill') ||
                   extractAttribute(xml, 'BillHistory', 'bill');
  if (!billAttr) return null;

  // Parse bill ID: "89(R) HB 1" -> "HB 1"
  const billIdMatch = billAttr.match(/([A-Z]{2,3})\s*(\d+)/i);
  if (!billIdMatch) return null;

  const billType = billIdMatch[1].toUpperCase() as BillType;
  const billNumber = parseInt(billIdMatch[2], 10);
  const billId = `${billType} ${billNumber}`;

  // Validate bill type
  const validTypes: BillType[] = ['HB', 'SB', 'HJR', 'SJR', 'HCR', 'SCR'];
  if (!validTypes.includes(billType)) {
    return null;
  }

  // Extract caption/description
  const description = extractText(xml, 'caption');
  if (!description) {
    return null; // Caption is required
  }

  // Extract last update date from attribute
  const lastUpdateAttr = extractAttribute(xml, 'billhistory', 'lastUpdate') ||
                         extractAttribute(xml, 'BillHistory', 'lastUpdate');
  const lastUpdate = lastUpdateAttr ? parseDate(lastUpdateAttr) : null;

  // Parse other fields
  const authors = parseNameList(extractText(xml, 'authors'));
  const coauthors = parseNameList(extractText(xml, 'coauthors'));
  const sponsors = parseNameList(extractText(xml, 'sponsors'));
  const cosponsors = parseNameList(extractText(xml, 'cosponsors'));
  const subjects = parseSubjects(xml);
  const actions = parseActions(xml);
  const committees = parseCommittees(xml);

  // Extract last action
  const lastAction = extractText(xml, 'lastaction');
  const lastActionDate = parseLastActionDate(lastAction);

  // Derive status from actions and committees
  const status = deriveStatus(actions, committees);

  // Get bill text URL
  const textUrl = parseTextUrl(xml);

  return {
    billId,
    billType,
    billNumber,
    description: description.substring(0, 2000),
    authors,
    coauthors,
    sponsors,
    cosponsors,
    subjects,
    status,
    lastAction: lastAction.substring(0, 500),
    lastActionDate,
    lastUpdate,
    textUrl,
    committees,
    actions,
  };
}
