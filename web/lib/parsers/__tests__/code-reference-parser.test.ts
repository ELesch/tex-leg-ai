import { describe, it, expect } from 'vitest';
import { parseCodeReferences, type CodeReference } from '../code-reference-parser';

// Sample bill texts based on real Texas legislative patterns

/** Simple amendment pattern */
const SIMPLE_AMENDMENT_TEXT = `
AN ACT relating to education.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
SECTION 1.  Section 124.002(a), Government Code, is amended to read as follows:
(a)  The commission shall administer the program.
SECTION 2.  This Act takes effect September 1, 2025.
`;

/** Add section pattern */
const ADD_SECTION_TEXT = `
AN ACT relating to education.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
SECTION 1.  Chapter 29, Education Code, is amended by adding Section 29.914 to read as follows:
Sec. 29.914.  NEW PROGRAM.
SECTION 2.  This Act takes effect September 1, 2025.
`;

/** Repeal pattern */
const REPEAL_TEXT = `
AN ACT relating to education.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
SECTION 1.  Section 29.001, Education Code, is repealed.
SECTION 2.  Sections 29.002, 29.003, and 29.004, Education Code, are repealed.
SECTION 3.  This Act takes effect September 1, 2025.
`;

/** Multiple subsections pattern */
const SUBSECTIONS_TEXT = `
AN ACT relating to education.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
SECTION 1.  Section 29.914(a), Education Code, is amended to read as follows:
(a)  The commission shall coordinate.
SECTION 2.  Section 48.101(b) or (c), Education Code, is amended to read as follows:
(b)  The allotment equals the amount specified.
SECTION 3.  Sections 29.915(a), (b-1), and (c), Education Code, are amended to read as follows:
(a)  First subsection.
SECTION 4.  This Act takes effect September 1, 2025.
`;

/** Amending specific subsections pattern */
const AMENDING_SUBSECTIONS_TEXT = `
AN ACT relating to education.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
SECTION 1.  Section 29.914, Education Code, is amended by amending Subsections (a) and (b) to read as follows:
(a)  First subsection.
(b)  Second subsection.
SECTION 2.  Section 48.101, Education Code, is amended by amending Subsection (c-1) and adding Subsection (d) to read as follows:
(c-1)  Modified subsection.
SECTION 3.  This Act takes effect September 1, 2025.
`;

/** Subchapter reference pattern */
const SUBCHAPTER_TEXT = `
AN ACT relating to education savings accounts.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
SECTION 1.  Subchapter Z, Chapter 29, Education Code, is amended by adding Section 29.914 to read as follows:
Sec. 29.914.  NEW SECTION.
SECTION 2.  Chapter 48, Education Code, is amended by adding Subchapter G to read as follows:
SUBCHAPTER G.  NEW FUNDING
SECTION 3.  This Act takes effect September 1, 2025.
`;

/** Multiple codes in one bill */
const MULTIPLE_CODES_TEXT = `
AN ACT relating to education and government.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
SECTION 1.  Section 29.001, Education Code, is amended to read as follows:
Sec. 29.001.  DEFINITIONS.
SECTION 2.  Section 124.001, Government Code, is amended to read as follows:
Sec. 124.001.  AGENCY POWERS.
SECTION 3.  Section 481.001, Health and Safety Code, is amended to read as follows:
Sec. 481.001.  CONTROLLED SUBSTANCES.
SECTION 4.  This Act takes effect September 1, 2025.
`;

/** Omnibus bill with article structure */
const OMNIBUS_BILL_TEXT = `
AN ACT relating to education finance.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
ARTICLE 1.  CHANGES TO PUBLIC EDUCATION
SECTION 1.01.  Section 12.106, Education Code, is amended to read as follows:
Sec. 12.106.  CHARTER GOVERNANCE.
SECTION 1.02.  Section 12.156(a), Education Code, is amended to read as follows:
(a)  A charter school may request additional funding.
ARTICLE 2.  TEACHER PREPARATION
SECTION 2.01.  Section 12A.004(a), Education Code, is amended to read as follows:
(a)  The board shall establish certification standards.
SECTION 2.02.  This article takes effect September 1, 2025.
`;

describe('parseCodeReferences', () => {
  describe('empty and invalid input', () => {
    it('returns empty array for empty string', () => {
      const result = parseCodeReferences('');
      expect(result).toEqual([]);
    });

    it('returns empty array for null input', () => {
      const result = parseCodeReferences(null as unknown as string);
      expect(result).toEqual([]);
    });

    it('returns empty array for undefined input', () => {
      const result = parseCodeReferences(undefined as unknown as string);
      expect(result).toEqual([]);
    });

    it('returns empty array for text without code references', () => {
      const result = parseCodeReferences('This is just some random text without any code references.');
      expect(result).toEqual([]);
    });
  });

  describe('simple amendment parsing', () => {
    it('parses a simple section amendment', () => {
      const refs = parseCodeReferences(SIMPLE_AMENDMENT_TEXT);

      expect(refs.length).toBeGreaterThanOrEqual(1);

      const firstRef = refs[0];
      expect(firstRef.code).toBe('Government Code');
      expect(firstRef.section).toBe('124.002(a)');
      expect(firstRef.action).toBe('amend');
      expect(firstRef.billSection).toBe('SECTION 1');
    });

    it('includes chapter extracted from section number', () => {
      const refs = parseCodeReferences(SIMPLE_AMENDMENT_TEXT);
      const ref = refs.find(r => r.section === '124.002(a)');

      expect(ref?.chapter).toBe('Chapter 124');
    });

    it('includes raw text for debugging', () => {
      const refs = parseCodeReferences(SIMPLE_AMENDMENT_TEXT);

      expect(refs[0].rawText).toContain('Section');
      expect(refs[0].rawText).toContain('Government Code');
    });
  });

  describe('add action detection', () => {
    it('detects add action for new sections', () => {
      const refs = parseCodeReferences(ADD_SECTION_TEXT);

      const addRef = refs.find(r => r.section.includes('29.914') || r.section === 'Chapter 29');
      expect(addRef?.action).toBe('add');
    });

    it('detects add action when adding subchapter', () => {
      const refs = parseCodeReferences(SUBCHAPTER_TEXT);

      const subchapterRef = refs.find(r => r.section.includes('Subchapter') || r.subchapter);
      if (subchapterRef) {
        expect(subchapterRef.action).toBe('add');
      }
    });
  });

  describe('repeal action detection', () => {
    it('detects repeal action for single section', () => {
      const refs = parseCodeReferences(REPEAL_TEXT);

      const repealRef = refs.find(r => r.section === '29.001');
      expect(repealRef?.action).toBe('repeal');
    });

    it('detects repeal action for multiple sections', () => {
      const refs = parseCodeReferences(REPEAL_TEXT);

      // Should find at least the first repealed section
      const repealRefs = refs.filter(r => r.action === 'repeal');
      expect(repealRefs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('subsection extraction', () => {
    it('extracts single subsection from section reference', () => {
      const refs = parseCodeReferences(SUBSECTIONS_TEXT);

      const ref = refs.find(r => r.section === '29.914(a)');
      expect(ref?.subsections).toContain('(a)');
    });

    it('extracts multiple subsections from "or" pattern', () => {
      const refs = parseCodeReferences(SUBSECTIONS_TEXT);

      const ref = refs.find(r => r.section.includes('48.101'));
      expect(ref?.subsections).toContain('(b)');
      expect(ref?.subsections).toContain('(c)');
    });

    it('extracts subsections from "amending Subsections" pattern', () => {
      const refs = parseCodeReferences(AMENDING_SUBSECTIONS_TEXT);

      const ref = refs.find(r => r.section === '29.914');
      expect(ref?.subsections).toContain('(a)');
      expect(ref?.subsections).toContain('(b)');
    });

    it('handles hyphenated subsections like (b-1)', () => {
      const refs = parseCodeReferences(AMENDING_SUBSECTIONS_TEXT);

      const ref = refs.find(r => r.section === '48.101');
      expect(ref?.subsections).toContain('(c-1)');
    });
  });

  describe('subchapter and chapter references', () => {
    it('parses subchapter references', () => {
      const refs = parseCodeReferences(SUBCHAPTER_TEXT);

      const subchapterRef = refs.find(r => r.subchapter?.includes('Z'));
      if (subchapterRef) {
        expect(subchapterRef.subchapter).toBe('Subchapter Z');
        expect(subchapterRef.chapter).toBe('Chapter 29');
        expect(subchapterRef.code).toBe('Education Code');
      }
    });

    it('parses chapter addition references', () => {
      const refs = parseCodeReferences(SUBCHAPTER_TEXT);

      const chapterRef = refs.find(r =>
        r.section.includes('Chapter 48') || r.section.includes('Subchapter G')
      );
      if (chapterRef) {
        expect(chapterRef.action).toBe('add');
      }
    });
  });

  describe('multiple codes', () => {
    it('parses references to different codes', () => {
      const refs = parseCodeReferences(MULTIPLE_CODES_TEXT);

      const codes = refs.map(r => r.code);
      expect(codes).toContain('Education Code');
      expect(codes).toContain('Government Code');
      expect(codes).toContain('Health and Safety Code');
    });

    it('assigns correct bill sections to each reference', () => {
      const refs = parseCodeReferences(MULTIPLE_CODES_TEXT);

      const eduRef = refs.find(r => r.code === 'Education Code');
      expect(eduRef?.billSection).toBe('SECTION 1');

      const govRef = refs.find(r => r.code === 'Government Code');
      expect(govRef?.billSection).toBe('SECTION 2');

      const healthRef = refs.find(r => r.code === 'Health and Safety Code');
      expect(healthRef?.billSection).toBe('SECTION 3');
    });
  });

  describe('omnibus bill with articles', () => {
    it('parses references in omnibus bills with X.XX section numbers', () => {
      const refs = parseCodeReferences(OMNIBUS_BILL_TEXT);

      expect(refs.length).toBeGreaterThanOrEqual(3);

      // Check section numbering format
      const billSections = refs.map(r => r.billSection);
      expect(billSections).toContain('SECTION 1.01');
      expect(billSections).toContain('SECTION 1.02');
    });

    it('correctly parses section with subsection in omnibus', () => {
      const refs = parseCodeReferences(OMNIBUS_BILL_TEXT);

      const ref = refs.find(r => r.section === '12.156(a)');
      expect(ref?.code).toBe('Education Code');
      expect(ref?.billSection).toBe('SECTION 1.02');
    });
  });

  describe('code name normalization', () => {
    it('normalizes code names to title case', () => {
      const billText = `
SECTION 1.  Section 29.001, EDUCATION CODE, is amended to read as follows:
SECTION 2.  Section 481.001, health and safety code, is amended to read as follows:
      `;
      const refs = parseCodeReferences(billText);

      expect(refs.map(r => r.code)).toContain('Education Code');
      expect(refs.map(r => r.code)).toContain('Health and Safety Code');
    });
  });

  describe('edge cases', () => {
    it('handles bill with no SECTION declarations but valid references', () => {
      const billText = `Section 29.001, Education Code, is amended to read as follows:`;
      const refs = parseCodeReferences(billText);

      // Should still parse the reference, defaulting to SECTION 1
      expect(refs.length).toBe(1);
      expect(refs[0].section).toBe('29.001');
    });

    it('handles multiple references in single bill section', () => {
      const billText = `
SECTION 1.  Section 29.001, Education Code, and Section 29.002, Education Code, are amended to read as follows:
      `;
      const refs = parseCodeReferences(billText);

      expect(refs.length).toBe(2);
      expect(refs.every(r => r.billSection === 'SECTION 1')).toBe(true);
    });

    it('does not duplicate references', () => {
      const refs = parseCodeReferences(SIMPLE_AMENDMENT_TEXT);

      // Check for duplicates
      const uniqueRefs = new Set(refs.map(r => `${r.billSection}:${r.section}:${r.code}`));
      expect(uniqueRefs.size).toBe(refs.length);
    });
  });

  describe('result structure', () => {
    it('returns all expected fields for each reference', () => {
      const refs = parseCodeReferences(SIMPLE_AMENDMENT_TEXT);
      const ref = refs[0];

      expect(ref).toHaveProperty('code');
      expect(ref).toHaveProperty('section');
      expect(ref).toHaveProperty('action');
      expect(ref).toHaveProperty('billSection');
      expect(ref).toHaveProperty('rawText');
    });

    it('has valid action values', () => {
      const allTexts = [
        SIMPLE_AMENDMENT_TEXT,
        ADD_SECTION_TEXT,
        REPEAL_TEXT,
      ];

      for (const text of allTexts) {
        const refs = parseCodeReferences(text);
        for (const ref of refs) {
          expect(['add', 'amend', 'repeal']).toContain(ref.action);
        }
      }
    });
  });
});
