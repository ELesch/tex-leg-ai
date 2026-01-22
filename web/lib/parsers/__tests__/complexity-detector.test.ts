import { describe, it, expect } from 'vitest';
import { detectComplexity, type ComplexityResult } from '../complexity-detector';

// Sample bill texts based on real Texas legislative patterns

/** Simple bill: HB 175 style - Texas Rising Star program, few sections */
const SIMPLE_BILL_TEXT = `
AN ACT
relating to the Texas Rising Star Program administered by the Texas
Workforce Commission.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
SECTION 1.  Section 124.002(a), Government Code, is amended to read as follows:
(a)  The commission shall administer the Texas Rising Star Program to rate the
quality of participating child-care providers.
SECTION 2.  This Act takes effect September 1, 2025.
`;

/** Moderate bill: HB 201 style - Financial crimes, ~6 sections */
const MODERATE_BILL_TEXT = `
AN ACT
relating to offenses involving financial crimes and fraud.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
SECTION 1.  Section 32.21(d), Penal Code, is amended to read as follows:
(d)  An offense under this section is a Class C misdemeanor.
SECTION 2.  Section 32.31(b), Penal Code, is amended to read as follows:
(b)  A person commits an offense if the person uses or possesses a fraudulent card.
SECTION 3.  Section 32.32(a), Penal Code, is amended to read as follows:
(a)  A person commits an offense if the person knowingly makes a false claim.
SECTION 4.  Section 32.33, Penal Code, is amended to read as follows:
Sec. 32.33.  HINDERING SECURED CREDITORS.
SECTION 5.  Section 32.34(a), Penal Code, is amended to read as follows:
(a)  A person commits an offense if the person fraudulently transfers property.
SECTION 6.  This Act takes effect September 1, 2025.
`;

/** Complex bill: SB 2 style - Education savings accounts, many sections */
const COMPLEX_BILL_TEXT = `
AN ACT
relating to the establishment of education savings accounts for students.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
SECTION 1.  Chapter 29, Education Code, is amended by adding Subchapter Z to read as follows:
SUBCHAPTER Z. EDUCATION SAVINGS ACCOUNTS
Sec. 29.901.  DEFINITIONS.
SECTION 2.  Section 29.902, Education Code, is added to read as follows:
Sec. 29.902.  ESTABLISHMENT OF PROGRAM.
SECTION 3.  Section 29.903, Education Code, is added to read as follows:
Sec. 29.903.  ELIGIBILITY.
SECTION 4.  Section 29.904, Education Code, is added to read as follows:
Sec. 29.904.  ACCOUNT ADMINISTRATION.
SECTION 5.  Section 29.905, Education Code, is added to read as follows:
Sec. 29.905.  QUALIFIED EXPENSES.
SECTION 6.  Section 29.906, Education Code, is added to read as follows:
Sec. 29.906.  ACCOUNT BALANCE.
SECTION 7.  Section 29.907, Education Code, is added to read as follows:
Sec. 29.907.  PARTICIPATING SCHOOLS.
SECTION 8.  Section 29.908, Education Code, is added to read as follows:
Sec. 29.908.  COMPLIANCE.
SECTION 9.  Section 29.909, Education Code, is added to read as follows:
Sec. 29.909.  FUNDING.
SECTION 10.  Section 29.910, Education Code, is added to read as follows:
Sec. 29.910.  RULES.
SECTION 11.  Section 48.101, Education Code, is amended to read as follows:
Sec. 48.101.  BASIC ALLOTMENT.
SECTION 12.  Section 48.102, Education Code, is amended to read as follows:
Sec. 48.102.  ADJUSTMENT.
SECTION 13.  Section 12.106, Education Code, is amended to read as follows:
Sec. 12.106.  GOVERNANCE.
SECTION 14.  Section 7.102(a), Government Code, is amended to read as follows:
(a)  The agency shall coordinate programs.
SECTION 15.  This Act takes effect September 1, 2025.
`;

/** Omnibus bill: HB 2 style - Education finance, 121 sections, 4 articles */
const OMNIBUS_BILL_TEXT = `
AN ACT
relating to public school finance, educator compensation, and student outcomes.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
ARTICLE 1.  CHANGES RELATED TO PUBLIC EDUCATION
SECTION 1.01.  Section 12.106, Education Code, is amended to read as follows:
Sec. 12.106.  CHARTER AMENDMENT.
SECTION 1.02.  Section 12.156(a), Education Code, is amended to read as follows:
(a)  A school may request funding.
SECTION 1.03.  Section 12.157, Education Code, is amended to read as follows:
Sec. 12.157.  ADDITIONAL FUNDING.
ARTICLE 2.  TEACHER PREPARATION
SECTION 2.01.  Section 12A.004(a), Education Code, is amended to read as follows:
(a)  The board shall establish standards.
SECTION 2.02.  Section 12A.005, Education Code, is amended to read as follows:
Sec. 12A.005.  CERTIFICATION REQUIREMENTS.
SECTION 2.03.  Section 12A.006, Education Code, is amended to read as follows:
Sec. 12A.006.  PROGRAM APPROVAL.
ARTICLE 3.  SCHOOL FUNDING
SECTION 3.01.  Section 48.101(a), Education Code, is amended to read as follows:
(a)  The basic allotment is $6,160.
SECTION 3.02.  Section 48.102, Education Code, is amended to read as follows:
Sec. 48.102.  ADJUSTMENT FACTORS.
SECTION 3.03.  Section 48.103, Education Code, is amended to read as follows:
Sec. 48.103.  SMALL DISTRICT ADJUSTMENT.
ARTICLE 4.  EFFECTIVE DATE
SECTION 4.01.  Except as otherwise provided by this Act, this Act takes effect September 1, 2025.
`;

/** Bill with many sections but single code (should be complex, not omnibus) */
const MANY_SECTIONS_SINGLE_CODE = `
AN ACT
relating to various provisions of the Education Code.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
${Array.from({ length: 15 }, (_, i) => `SECTION ${i + 1}.  Section 29.${900 + i}, Education Code, is amended to read as follows:`).join('\n')}
SECTION 16.  This Act takes effect September 1, 2025.
`;

/** Bill with terminology replacement pattern */
const TERMINOLOGY_REPLACEMENT_BILL = `
AN ACT
relating to renaming of the Texas Natural Resource Conservation Commission.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
SECTION 1.  Section 5.001, Water Code, is amended to read as follows:
Sec. 5.001.  DEFINITIONS. In this chapter, each reference to "Texas Natural Resource Conservation Commission" means "Texas Commission on Environmental Quality".
SECTION 2.  Section 5.002(a), Water Code, is amended by striking "Texas Natural Resource Conservation Commission" and substituting "Texas Commission on Environmental Quality".
SECTION 3.  Section 5.003(b), Water Code, is amended by striking "Texas Natural Resource Conservation Commission" and substituting "Texas Commission on Environmental Quality".
SECTION 4.  Section 5.004, Water Code, is amended by striking "Texas Natural Resource Conservation Commission" and substituting "Texas Commission on Environmental Quality".
SECTION 5.  This Act takes effect September 1, 2025.
`;

/** Bill with multiple codes */
const MULTIPLE_CODES_BILL = `
AN ACT
relating to educational and governmental coordination.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
SECTION 1.  Section 29.001, Education Code, is amended to read as follows:
Sec. 29.001.  DEFINITIONS.
SECTION 2.  Section 124.001, Government Code, is amended to read as follows:
Sec. 124.001.  AGENCY POWERS.
SECTION 3.  Section 481.001, Health and Safety Code, is amended to read as follows:
Sec. 481.001.  DEFINITIONS.
SECTION 4.  This Act takes effect September 1, 2025.
`;

describe('detectComplexity', () => {
  describe('empty and invalid input', () => {
    it('returns simple complexity for empty string', () => {
      const result = detectComplexity('');
      expect(result.complexity).toBe('simple');
      expect(result.sectionCount).toBe(0);
      expect(result.articleCount).toBe(0);
      expect(result.affectedCodes).toEqual([]);
    });

    it('returns simple complexity for null-ish input', () => {
      const result = detectComplexity(null as unknown as string);
      expect(result.complexity).toBe('simple');
    });

    it('returns simple complexity for undefined input', () => {
      const result = detectComplexity(undefined as unknown as string);
      expect(result.complexity).toBe('simple');
    });
  });

  describe('simple bills (1-3 sections, single code)', () => {
    it('correctly identifies a simple bill', () => {
      const result = detectComplexity(SIMPLE_BILL_TEXT);

      expect(result.complexity).toBe('simple');
      expect(result.sectionCount).toBe(2);
      expect(result.articleCount).toBe(0);
      expect(result.affectedCodes).toContain('Government Code');
      expect(result.pattern).toBe('single_code');
    });

    it('identifies simple bill with 3 sections', () => {
      const billText = `
SECTION 1.  Section 29.001, Education Code, is amended.
SECTION 2.  Section 29.002, Education Code, is amended.
SECTION 3.  This Act takes effect September 1, 2025.
      `;
      const result = detectComplexity(billText);

      expect(result.complexity).toBe('simple');
      expect(result.sectionCount).toBe(3);
    });
  });

  describe('moderate bills (4-10 sections, 1-2 codes)', () => {
    it('correctly identifies a moderate bill', () => {
      const result = detectComplexity(MODERATE_BILL_TEXT);

      expect(result.complexity).toBe('moderate');
      expect(result.sectionCount).toBe(6);
      expect(result.articleCount).toBe(0);
      expect(result.affectedCodes).toContain('Penal Code');
    });

    it('identifies moderate bill with exactly 4 sections', () => {
      const billText = `
SECTION 1.  Section 29.001, Education Code, is amended.
SECTION 2.  Section 29.002, Education Code, is amended.
SECTION 3.  Section 29.003, Education Code, is amended.
SECTION 4.  This Act takes effect September 1, 2025.
      `;
      const result = detectComplexity(billText);

      expect(result.complexity).toBe('moderate');
      expect(result.sectionCount).toBe(4);
    });

    it('identifies moderate bill with 10 sections', () => {
      const billText = Array.from({ length: 10 }, (_, i) =>
        `SECTION ${i + 1}.  Section 29.${900 + i}, Education Code, is amended.`
      ).join('\n');

      const result = detectComplexity(billText);

      expect(result.complexity).toBe('moderate');
      expect(result.sectionCount).toBe(10);
    });
  });

  describe('complex bills (11-50 sections or 3+ codes)', () => {
    it('correctly identifies a complex bill by section count', () => {
      const result = detectComplexity(COMPLEX_BILL_TEXT);

      expect(result.complexity).toBe('complex');
      expect(result.sectionCount).toBe(15);
      expect(result.articleCount).toBe(0);
    });

    it('correctly identifies a complex bill by code count', () => {
      const result = detectComplexity(MULTIPLE_CODES_BILL);

      expect(result.complexity).toBe('complex');
      expect(result.affectedCodes.length).toBeGreaterThanOrEqual(3);
      expect(result.affectedCodes).toContain('Education Code');
      expect(result.affectedCodes).toContain('Government Code');
      expect(result.affectedCodes).toContain('Health and Safety Code');
    });

    it('identifies complex bill with 11 sections', () => {
      const billText = Array.from({ length: 11 }, (_, i) =>
        `SECTION ${i + 1}.  Section 29.${900 + i}, Education Code, is amended.`
      ).join('\n');

      const result = detectComplexity(billText);

      expect(result.complexity).toBe('complex');
      expect(result.sectionCount).toBe(11);
    });

    it('identifies complex bill with many sections single code', () => {
      const result = detectComplexity(MANY_SECTIONS_SINGLE_CODE);

      expect(result.complexity).toBe('complex');
      expect(result.sectionCount).toBe(16);
      expect(result.pattern).toBe('single_code');
    });
  });

  describe('omnibus bills (50+ sections or ARTICLE structure)', () => {
    it('correctly identifies an omnibus bill by ARTICLE structure', () => {
      const result = detectComplexity(OMNIBUS_BILL_TEXT);

      expect(result.complexity).toBe('omnibus');
      expect(result.articleCount).toBe(4);
      expect(result.pattern).toBe('omnibus');
    });

    it('identifies omnibus bill with 51+ sections', () => {
      const billText = Array.from({ length: 55 }, (_, i) =>
        `SECTION ${i + 1}.  Section 29.${900 + i}, Education Code, is amended.`
      ).join('\n');

      const result = detectComplexity(billText);

      expect(result.complexity).toBe('omnibus');
      expect(result.sectionCount).toBe(55);
      expect(result.pattern).toBe('omnibus');
    });

    it('prioritizes ARTICLE detection over section count', () => {
      const billText = `
ARTICLE 1.  FIRST PART
SECTION 1.01.  Section 29.001, Education Code, is amended.
SECTION 1.02.  Section 29.002, Education Code, is amended.
      `;
      const result = detectComplexity(billText);

      expect(result.complexity).toBe('omnibus');
      expect(result.articleCount).toBe(1);
      expect(result.pattern).toBe('omnibus');
    });
  });

  describe('terminology replacement detection', () => {
    it('detects terminology replacement pattern', () => {
      const result = detectComplexity(TERMINOLOGY_REPLACEMENT_BILL);

      expect(result.pattern).toBe('terminology_replacement');
      expect(result.terminologyReplacement).toBeDefined();
      expect(result.terminologyReplacement?.fromTerm).toBe('Texas Natural Resource Conservation Commission');
      expect(result.terminologyReplacement?.toTerm).toBe('Texas Commission on Environmental Quality');
      expect(result.terminologyReplacement?.occurrenceCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('code extraction', () => {
    it('extracts all affected codes from complex bill', () => {
      const result = detectComplexity(COMPLEX_BILL_TEXT);

      expect(result.affectedCodes).toContain('Education Code');
      expect(result.affectedCodes).toContain('Government Code');
    });

    it('normalizes code names correctly', () => {
      const billText = `
SECTION 1.  Section 29.001, EDUCATION CODE, is amended.
SECTION 2.  Section 481.001, health and safety code, is amended.
      `;
      const result = detectComplexity(billText);

      expect(result.affectedCodes).toContain('Education Code');
      expect(result.affectedCodes).toContain('Health and Safety Code');
    });

    it('deduplicates code references', () => {
      const billText = `
SECTION 1.  Section 29.001, Education Code, is amended.
SECTION 2.  Section 29.002, Education Code, is amended.
SECTION 3.  Section 29.003, Education Code, is amended.
      `;
      const result = detectComplexity(billText);

      expect(result.affectedCodes).toHaveLength(1);
      expect(result.affectedCodes[0]).toBe('Education Code');
    });
  });

  describe('section counting', () => {
    it('counts standard SECTION format', () => {
      const billText = `
SECTION 1.  First section.
SECTION 2.  Second section.
SECTION 3.  Third section.
      `;
      const result = detectComplexity(billText);

      expect(result.sectionCount).toBe(3);
    });

    it('counts omnibus SECTION format (X.XX)', () => {
      const billText = `
SECTION 1.01.  First section.
SECTION 1.02.  Second section.
SECTION 2.01.  Third section.
      `;
      const result = detectComplexity(billText);

      expect(result.sectionCount).toBe(3);
    });

    it('does not count SECTION mentioned in text (not declaration)', () => {
      const billText = `
SECTION 1.  Section 29.001, Education Code, references Section 29.002.
SECTION 2.  This Act takes effect September 1, 2025.
      `;
      const result = detectComplexity(billText);

      expect(result.sectionCount).toBe(2);
    });
  });

  describe('article counting', () => {
    it('counts Arabic numeral articles', () => {
      const billText = `
ARTICLE 1.  FIRST ARTICLE
SECTION 1.01.  Content here.
ARTICLE 2.  SECOND ARTICLE
SECTION 2.01.  Content here.
      `;
      const result = detectComplexity(billText);

      expect(result.articleCount).toBe(2);
    });

    it('counts Roman numeral articles', () => {
      const billText = `
ARTICLE I.  FIRST ARTICLE
SECTION 1.01.  Content here.
ARTICLE II.  SECOND ARTICLE
SECTION 2.01.  Content here.
ARTICLE III.  THIRD ARTICLE
SECTION 3.01.  Content here.
      `;
      const result = detectComplexity(billText);

      expect(result.articleCount).toBe(3);
    });
  });

  describe('result structure', () => {
    it('returns all expected fields', () => {
      const result = detectComplexity(MODERATE_BILL_TEXT);

      expect(result).toHaveProperty('complexity');
      expect(result).toHaveProperty('pattern');
      expect(result).toHaveProperty('articleCount');
      expect(result).toHaveProperty('sectionCount');
      expect(result).toHaveProperty('affectedCodes');
      expect(Array.isArray(result.affectedCodes)).toBe(true);
    });

    it('returns sorted affectedCodes array', () => {
      const result = detectComplexity(MULTIPLE_CODES_BILL);

      // Check that array is sorted
      const sorted = [...result.affectedCodes].sort();
      expect(result.affectedCodes).toEqual(sorted);
    });
  });
});
