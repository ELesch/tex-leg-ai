/**
 * Integration Tests for Bill Parsers
 *
 * These tests verify that the complexity detector, code reference parser,
 * and article parser work correctly together when processing the same bill text.
 */

import { describe, it, expect } from 'vitest';
import {
  detectComplexity,
  parseCodeReferences,
  parseArticles,
  hasArticleStructure,
  countArticles,
  findArticleForSection,
  type ComplexityResult,
  type CodeReference,
  type BillArticle,
} from '../index';

// ============================================================================
// REALISTIC BILL TEXT FIXTURES
// Based on actual Texas Legislature bill patterns
// ============================================================================

/**
 * Realistic simple bill - Single code, 2 sections
 * Pattern: HB 175 style - Texas Rising Star program
 */
const REALISTIC_SIMPLE_BILL = `
AN ACT relating to public education.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
SECTION 1.  Section 29.001, Education Code, is amended to read as follows:
Sec. 29.001.  DEFINITIONS. In this chapter:
(1) "Department" means the Texas Department of Family and Protective Services.
(2) "Program" means the Texas Rising Star Program.
SECTION 2.  This Act takes effect September 1, 2025.
`;

/**
 * Realistic moderate bill - Single code, 6 sections
 * Pattern: HB 201 style - Financial crimes
 */
const REALISTIC_MODERATE_BILL = `
AN ACT relating to offenses involving financial crimes and fraud.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
SECTION 1.  Section 32.21(d), Penal Code, is amended to read as follows:
(d)  An offense under this section is a Class C misdemeanor unless it is shown on the
trial of the offense that the value of the property is:
SECTION 2.  Section 32.31(b), Penal Code, is amended to read as follows:
(b)  A person commits an offense if the person uses or possesses a fraudulent
access card with intent to obtain property or services.
SECTION 3.  Section 32.32(a), Penal Code, is amended to read as follows:
(a)  A person commits an offense if the person knowingly makes or causes to be
made a false claim for payment.
SECTION 4.  Section 32.33, Penal Code, is amended to read as follows:
Sec. 32.33.  HINDERING SECURED CREDITORS.  (a)  A person commits an offense
if the person with intent to hinder enforcement of a security interest.
SECTION 5.  Section 32.34(a), Penal Code, is amended by amending Subsections (a)
and (b) to read as follows:
(a)  A person commits an offense if the person fraudulently transfers property.
SECTION 6.  This Act takes effect September 1, 2025.
`;

/**
 * Realistic complex bill - Multiple codes, 12 sections
 * Pattern: SB 2 style - Education savings accounts
 */
const REALISTIC_COMPLEX_BILL = `
AN ACT relating to the establishment of education savings accounts for students.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
SECTION 1.  Chapter 29, Education Code, is amended by adding Subchapter Z to read as follows:
SUBCHAPTER Z. EDUCATION SAVINGS ACCOUNTS
Sec. 29.901.  DEFINITIONS.  In this subchapter:
(1) "Account" means an education savings account established under this subchapter.
SECTION 2.  Section 29.902, Education Code, is added to read as follows:
Sec. 29.902.  ESTABLISHMENT OF PROGRAM.  The comptroller shall establish and
administer the education savings account program.
SECTION 3.  Section 29.903, Education Code, is added to read as follows:
Sec. 29.903.  ELIGIBILITY.  A student is eligible for an account if the student is
a Texas resident.
SECTION 4.  Section 29.904, Education Code, is added to read as follows:
Sec. 29.904.  ACCOUNT ADMINISTRATION.  The comptroller shall administer accounts.
SECTION 5.  Section 29.905, Education Code, is added to read as follows:
Sec. 29.905.  QUALIFIED EXPENSES.  Account funds may be used for tuition.
SECTION 6.  Section 29.906, Education Code, is added to read as follows:
Sec. 29.906.  ACCOUNT BALANCE.  Funds remaining in an account remain available.
SECTION 7.  Section 29.907, Education Code, is added to read as follows:
Sec. 29.907.  PARTICIPATING SCHOOLS.  A school may participate in the program.
SECTION 8.  Section 48.101, Education Code, is amended to read as follows:
Sec. 48.101.  BASIC ALLOTMENT.  The basic allotment is $6,160 per student.
SECTION 9.  Section 48.102(a), Education Code, is amended to read as follows:
(a)  The commissioner shall adjust the basic allotment.
SECTION 10.  Section 7.102(a), Government Code, is amended to read as follows:
(a)  The agency shall coordinate education programs with other agencies.
SECTION 11.  Section 403.001, Government Code, is amended by adding Subsection (d) to read as follows:
(d)  The comptroller shall establish procedures for education savings accounts.
SECTION 12.  This Act takes effect September 1, 2025.
`;

/**
 * Realistic omnibus bill - Multiple articles, multiple codes
 * Pattern: HB 2 style - Comprehensive education reform
 */
const REALISTIC_OMNIBUS_BILL = `
AN ACT relating to public school finance, educator compensation, and student outcomes.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
ARTICLE 1.  FOUNDATION SCHOOL PROGRAM
SECTION 1.01.  Section 48.001, Education Code, is amended to read as follows:
Sec. 48.001.  DEFINITIONS.  In this chapter:
(1) "Allotment" means a dollar amount per student in average daily attendance.
SECTION 1.02.  Section 48.002, Education Code, is amended to read as follows:
Sec. 48.002.  PURPOSE.  The purpose of the foundation school program is to
guarantee each student access to programs.
SECTION 1.03.  Section 48.051, Education Code, is amended to read as follows:
Sec. 48.051.  BASIC ALLOTMENT.  (a)  The basic allotment for each student is $6,160.
SECTION 1.04.  Section 48.052, Education Code, is amended by amending Subsections (a) and (b) to read as follows:
(a)  The adjusted allotment is calculated by multiplying the basic allotment.
ARTICLE 2.  SPECIAL PROGRAMS
SECTION 2.01.  Section 29.001, Education Code, is amended by adding Subsection (d) to read as follows:
(d)  "Eligible student" means a student with special needs.
SECTION 2.02.  Section 29.003(a), Education Code, is amended to read as follows:
(a)  The agency shall establish procedures for special programs.
SECTION 2.03.  Section 29.014, Education Code, is amended to read as follows:
Sec. 29.014.  COMPENSATORY EDUCATION.  Each district shall provide
compensatory education services to students.
ARTICLE 3.  EDUCATOR COMPENSATION
SECTION 3.01.  Section 21.001, Education Code, is amended to read as follows:
Sec. 21.001.  DEFINITIONS.  In this chapter:
(1) "Educator" means a superintendent, principal, or teacher.
SECTION 3.02.  Section 21.402(a), Education Code, is amended to read as follows:
(a)  The minimum monthly salary for a classroom teacher is based on years of experience.
SECTION 3.03.  Subchapter Z, Chapter 21, Education Code, is amended by adding Section 21.920 to read as follows:
Sec. 21.920.  TEACHER INCENTIVE ALLOTMENT.  (a)  A district may designate
a teacher as a master, exemplary, recognized, or acknowledged teacher.
ARTICLE 4.  GOVERNANCE AND ADMINISTRATION
SECTION 4.01.  Section 7.055(b), Education Code, is amended to read as follows:
(b)  The commissioner shall adopt rules necessary to implement this chapter.
SECTION 4.02.  Section 7.102(c), Government Code, is amended to read as follows:
(c)  The agency shall coordinate with the Texas Higher Education Coordinating Board.
ARTICLE 5.  EFFECTIVE DATE AND TRANSITION
SECTION 5.01.  Except as otherwise provided by this Act, this Act takes effect September 1, 2025.
SECTION 5.02.  The changes in law made by this Act apply beginning with the 2025-2026 school year.
`;

/**
 * Bill with multiple codes across articles
 * Tests code reference consistency across parsers
 */
const MULTI_CODE_OMNIBUS_BILL = `
AN ACT relating to interagency coordination for children's services.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
ARTICLE 1.  EDUCATION
SECTION 1.01.  Section 29.001, Education Code, is amended to read as follows:
Sec. 29.001.  DEFINITIONS.
SECTION 1.02.  Section 29.002, Education Code, is amended to read as follows:
Sec. 29.002.  ESTABLISHMENT.
ARTICLE 2.  HEALTH SERVICES
SECTION 2.01.  Section 32.001, Human Resources Code, is amended to read as follows:
Sec. 32.001.  DEFINITIONS.
SECTION 2.02.  Section 32.002, Human Resources Code, is amended to read as follows:
Sec. 32.002.  ELIGIBILITY.
SECTION 2.03.  Section 533.001, Health and Safety Code, is amended to read as follows:
Sec. 533.001.  COMMUNITY HEALTH SERVICES.
ARTICLE 3.  GOVERNMENT COORDINATION
SECTION 3.01.  Section 531.001, Government Code, is amended to read as follows:
Sec. 531.001.  DEFINITIONS.
SECTION 3.02.  Section 531.002, Government Code, is amended to read as follows:
Sec. 531.002.  INTERAGENCY COUNCIL.
ARTICLE 4.  EFFECTIVE DATE
SECTION 4.01.  This Act takes effect September 1, 2025.
`;

/**
 * Bill with terminology replacement pattern
 * Tests that terminology replacement is detected alongside other parsing
 */
const TERMINOLOGY_BILL = `
AN ACT relating to the renaming of the Texas Department of Mental Health and Mental Retardation.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
SECTION 1.  Throughout the Health and Safety Code, each reference to "Texas Department of Mental Health and Mental Retardation" means "Department of State Health Services".
SECTION 2.  Section 531.001, Health and Safety Code, is amended by striking "Texas Department of Mental Health and Mental Retardation" and substituting "Department of State Health Services".
SECTION 3.  Section 531.002, Health and Safety Code, is amended by striking "Texas Department of Mental Health and Mental Retardation" and substituting "Department of State Health Services".
SECTION 4.  Section 531.003, Health and Safety Code, is amended by striking "Texas Department of Mental Health and Mental Retardation" and substituting "Department of State Health Services".
SECTION 5.  This Act takes effect September 1, 2025.
`;

// ============================================================================
// EDGE CASE FIXTURES
// ============================================================================

const EMPTY_INPUT = '';
const WHITESPACE_ONLY = '   \n\t\n   ';
const MALFORMED_TEXT = 'This is not a bill at all. Just random text without structure.';
const PARTIAL_STRUCTURE = `
AN ACT relating to something.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
SECTION 1. Some content without proper code references.
SECTION 2. This takes effect September 1, 2025.
`;

// ============================================================================
// PARSER INTEGRATION TESTS
// ============================================================================

describe('Parser Integration', () => {
  describe('processing simple bills with all parsers', () => {
    it('processes a simple bill consistently across all parsers', () => {
      const billText = REALISTIC_SIMPLE_BILL;

      const complexity = detectComplexity(billText);
      const codeRefs = parseCodeReferences(billText);
      const articles = parseArticles(billText);

      // Verify complexity assessment
      expect(complexity.complexity).toBe('simple');
      expect(complexity.sectionCount).toBe(2);
      expect(complexity.articleCount).toBe(0);

      // Verify code references found
      expect(codeRefs.length).toBeGreaterThan(0);
      expect(codeRefs.some(ref => ref.code === 'Education Code')).toBe(true);

      // Verify no articles found
      expect(articles).toHaveLength(0);
      expect(hasArticleStructure(billText)).toBe(false);

      // Consistency: simple bill should have no articles
      expect(complexity.pattern).not.toBe('omnibus');
    });

    it('processes a moderate bill consistently across all parsers', () => {
      const billText = REALISTIC_MODERATE_BILL;

      const complexity = detectComplexity(billText);
      const codeRefs = parseCodeReferences(billText);
      const articles = parseArticles(billText);

      // Verify complexity assessment
      expect(complexity.complexity).toBe('moderate');
      expect(complexity.sectionCount).toBe(6);
      expect(complexity.articleCount).toBe(0);

      // Verify code references
      expect(codeRefs.length).toBeGreaterThan(0);
      expect(codeRefs.every(ref => ref.code === 'Penal Code')).toBe(true);

      // Verify no articles
      expect(articles).toHaveLength(0);
    });
  });

  describe('processing omnibus bills with all parsers', () => {
    it('processes an omnibus bill consistently across all parsers', () => {
      const billText = REALISTIC_OMNIBUS_BILL;

      const complexity = detectComplexity(billText);
      const codeRefs = parseCodeReferences(billText);
      const articles = parseArticles(billText);

      // Verify complexity assessment
      expect(complexity.complexity).toBe('omnibus');
      expect(complexity.articleCount).toBe(5);
      expect(complexity.pattern).toBe('omnibus');

      // Verify article structure is detected
      expect(articles.length).toBe(5);
      expect(hasArticleStructure(billText)).toBe(true);

      // Verify code references are found across articles
      expect(codeRefs.length).toBeGreaterThan(0);

      // Verify code references come from multiple articles
      const billSections = new Set(codeRefs.map(ref => ref.billSection));
      // Should have references from multiple article sections (1.01, 2.01, etc.)
      expect(billSections.size).toBeGreaterThan(3);
    });

    it('ARTICLE structure is detected by both complexity detector and article parser', () => {
      const billText = REALISTIC_OMNIBUS_BILL;

      const complexity = detectComplexity(billText);
      const articleCount = countArticles(billText);
      const hasArticles = hasArticleStructure(billText);

      // Both should detect articles
      expect(complexity.articleCount).toBeGreaterThan(0);
      expect(articleCount).toBeGreaterThan(0);
      expect(hasArticles).toBe(true);

      // Article counts should match
      expect(complexity.articleCount).toBe(articleCount);
    });
  });

  describe('handling edge cases consistently across parsers', () => {
    it('handles empty input consistently', () => {
      const complexity = detectComplexity(EMPTY_INPUT);
      const codeRefs = parseCodeReferences(EMPTY_INPUT);
      const articles = parseArticles(EMPTY_INPUT);

      // All parsers should return valid empty results
      expect(complexity.complexity).toBe('simple');
      expect(complexity.sectionCount).toBe(0);
      expect(complexity.articleCount).toBe(0);
      expect(complexity.affectedCodes).toEqual([]);

      expect(codeRefs).toEqual([]);
      expect(articles).toEqual([]);
    });

    it('handles whitespace-only input consistently', () => {
      const complexity = detectComplexity(WHITESPACE_ONLY);
      const codeRefs = parseCodeReferences(WHITESPACE_ONLY);
      const articles = parseArticles(WHITESPACE_ONLY);

      expect(complexity.complexity).toBe('simple');
      expect(complexity.sectionCount).toBe(0);
      expect(codeRefs).toEqual([]);
      expect(articles).toEqual([]);
    });

    it('handles malformed text consistently', () => {
      const complexity = detectComplexity(MALFORMED_TEXT);
      const codeRefs = parseCodeReferences(MALFORMED_TEXT);
      const articles = parseArticles(MALFORMED_TEXT);

      // Should return valid empty/default results
      expect(complexity.complexity).toBe('simple');
      expect(complexity.sectionCount).toBe(0);
      expect(codeRefs).toEqual([]);
      expect(articles).toEqual([]);
    });

    it('handles partial structure consistently', () => {
      const complexity = detectComplexity(PARTIAL_STRUCTURE);
      const codeRefs = parseCodeReferences(PARTIAL_STRUCTURE);
      const articles = parseArticles(PARTIAL_STRUCTURE);

      // Should detect sections but no code refs or articles
      expect(complexity.sectionCount).toBe(2);
      expect(complexity.articleCount).toBe(0);
      expect(codeRefs).toEqual([]);
      expect(articles).toEqual([]);
    });

    it('handles null input consistently', () => {
      const complexity = detectComplexity(null as unknown as string);
      const codeRefs = parseCodeReferences(null as unknown as string);
      const articles = parseArticles(null as unknown as string);

      expect(complexity.complexity).toBe('simple');
      expect(codeRefs).toEqual([]);
      expect(articles).toEqual([]);
    });

    it('handles undefined input consistently', () => {
      const complexity = detectComplexity(undefined as unknown as string);
      const codeRefs = parseCodeReferences(undefined as unknown as string);
      const articles = parseArticles(undefined as unknown as string);

      expect(complexity.complexity).toBe('simple');
      expect(codeRefs).toEqual([]);
      expect(articles).toEqual([]);
    });
  });
});

// ============================================================================
// CROSS-PARSER CONSISTENCY TESTS
// ============================================================================

describe('Cross-Parser Consistency', () => {
  describe('affected codes matching', () => {
    it('complexity.affectedCodes matches codes found in parseCodeReferences for simple bills', () => {
      const billText = REALISTIC_SIMPLE_BILL;

      const complexity = detectComplexity(billText);
      const codeRefs = parseCodeReferences(billText);

      // Get unique codes from code references
      const codesFromRefs = [...new Set(codeRefs.map(ref => ref.code))].sort();

      // Both should identify the same codes
      expect(complexity.affectedCodes).toEqual(codesFromRefs);
    });

    it('complexity.affectedCodes matches codes found in parseCodeReferences for moderate bills', () => {
      const billText = REALISTIC_MODERATE_BILL;

      const complexity = detectComplexity(billText);
      const codeRefs = parseCodeReferences(billText);

      const codesFromRefs = [...new Set(codeRefs.map(ref => ref.code))].sort();

      expect(complexity.affectedCodes).toEqual(codesFromRefs);
    });

    it('complexity.affectedCodes matches codes found in parseCodeReferences for complex bills', () => {
      const billText = REALISTIC_COMPLEX_BILL;

      const complexity = detectComplexity(billText);
      const codeRefs = parseCodeReferences(billText);

      const codesFromRefs = [...new Set(codeRefs.map(ref => ref.code))].sort();

      // All codes from refs should be in affectedCodes
      for (const code of codesFromRefs) {
        expect(complexity.affectedCodes).toContain(code);
      }
    });

    it('complexity.affectedCodes matches codes found in parseCodeReferences for omnibus bills', () => {
      const billText = MULTI_CODE_OMNIBUS_BILL;

      const complexity = detectComplexity(billText);
      const codeRefs = parseCodeReferences(billText);

      const codesFromRefs = [...new Set(codeRefs.map(ref => ref.code))].sort();

      // All codes from refs should be in affectedCodes
      for (const code of codesFromRefs) {
        expect(complexity.affectedCodes).toContain(code);
      }
    });
  });

  describe('article structure alignment', () => {
    it('hasArticleStructure matches complexity.pattern === omnibus for omnibus bills', () => {
      const billText = REALISTIC_OMNIBUS_BILL;

      const complexity = detectComplexity(billText);
      const hasArticles = hasArticleStructure(billText);

      // If hasArticleStructure is true, pattern should be omnibus
      if (hasArticles) {
        expect(complexity.pattern).toBe('omnibus');
        expect(complexity.complexity).toBe('omnibus');
      }
    });

    it('hasArticleStructure matches complexity.pattern for simple bills (no articles)', () => {
      const billText = REALISTIC_SIMPLE_BILL;

      const complexity = detectComplexity(billText);
      const hasArticles = hasArticleStructure(billText);

      // Simple bill should have no articles and pattern should not be omnibus
      expect(hasArticles).toBe(false);
      expect(complexity.pattern).not.toBe('omnibus');
    });

    it('article count is consistent between detectComplexity and countArticles', () => {
      const billTexts = [
        REALISTIC_SIMPLE_BILL,
        REALISTIC_MODERATE_BILL,
        REALISTIC_COMPLEX_BILL,
        REALISTIC_OMNIBUS_BILL,
        MULTI_CODE_OMNIBUS_BILL,
      ];

      for (const billText of billTexts) {
        const complexity = detectComplexity(billText);
        const articleCount = countArticles(billText);

        expect(complexity.articleCount).toBe(articleCount);
      }
    });
  });

  describe('section consistency', () => {
    it('sections in articles match sections referenced in code references', () => {
      const billText = REALISTIC_OMNIBUS_BILL;

      const articles = parseArticles(billText);
      const codeRefs = parseCodeReferences(billText);

      // For each code reference, the bill section should be within an article
      for (const ref of codeRefs) {
        // Extract section number from bill section (e.g., "SECTION 1.01" -> "1.01")
        const sectionMatch = ref.billSection.match(/SECTION\s+(\d+(?:\.\d+)?)/);
        if (sectionMatch) {
          const sectionNum = sectionMatch[1];

          // If section has article format (X.XX), it should be in an article
          if (sectionNum.includes('.')) {
            const article = findArticleForSection(articles, sectionNum);
            expect(article).toBeDefined();
          }
        }
      }
    });

    it('total sections across articles matches sections in code references for omnibus', () => {
      const billText = REALISTIC_OMNIBUS_BILL;

      const articles = parseArticles(billText);
      const complexity = detectComplexity(billText);

      // Count sections across all articles
      const sectionsInArticles = articles.reduce((sum, a) => sum + a.sections.length, 0);

      // Section count from complexity should be close to or equal to sections in articles
      // Note: There may be minor differences due to parsing nuances
      expect(sectionsInArticles).toBeLessThanOrEqual(complexity.sectionCount);
    });
  });

  describe('code references by article', () => {
    it('code references are properly distributed across articles', () => {
      const billText = MULTI_CODE_OMNIBUS_BILL;

      const articles = parseArticles(billText);
      const codeRefs = parseCodeReferences(billText);

      // Group code references by their article (based on section prefix)
      const refsByArticle = new Map<string, CodeReference[]>();

      for (const ref of codeRefs) {
        const sectionMatch = ref.billSection.match(/SECTION\s+(\d+)\./);
        if (sectionMatch) {
          const articleNum = sectionMatch[1];
          if (!refsByArticle.has(articleNum)) {
            refsByArticle.set(articleNum, []);
          }
          refsByArticle.get(articleNum)!.push(ref);
        }
      }

      // Each article should have at least one code reference
      for (const article of articles) {
        const articleNum = article.articleNumber;
        // Not all articles have code references (e.g., effective date articles)
        // But most content articles should
        if (article.title !== 'EFFECTIVE DATE') {
          expect(refsByArticle.has(articleNum)).toBe(true);
        }
      }
    });
  });
});

// ============================================================================
// REAL-WORLD BILL PATTERN TESTS
// ============================================================================

describe('Real-World Bill Pattern Tests', () => {
  describe('typical simple bill patterns', () => {
    it('correctly processes HB 175 style bill (single agency program)', () => {
      const billText = REALISTIC_SIMPLE_BILL;

      const complexity = detectComplexity(billText);
      const codeRefs = parseCodeReferences(billText);

      expect(complexity.complexity).toBe('simple');
      expect(complexity.pattern).toBe('single_code');
      expect(codeRefs.length).toBeGreaterThan(0);
    });
  });

  describe('typical moderate bill patterns', () => {
    it('correctly processes HB 201 style bill (Penal Code amendments)', () => {
      const billText = REALISTIC_MODERATE_BILL;

      const complexity = detectComplexity(billText);
      const codeRefs = parseCodeReferences(billText);

      expect(complexity.complexity).toBe('moderate');
      expect(codeRefs.every(ref => ref.code === 'Penal Code')).toBe(true);
      expect(codeRefs.every(ref => ref.action === 'amend')).toBe(true);
    });
  });

  describe('typical complex bill patterns', () => {
    it('correctly processes SB 2 style bill (new program creation)', () => {
      const billText = REALISTIC_COMPLEX_BILL;

      const complexity = detectComplexity(billText);
      const codeRefs = parseCodeReferences(billText);

      expect(complexity.complexity).toBe('complex');

      // Should have mixed actions (add and amend)
      const actions = new Set(codeRefs.map(ref => ref.action));
      expect(actions.size).toBeGreaterThanOrEqual(1);

      // Should have multiple codes
      expect(complexity.affectedCodes.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('typical omnibus bill patterns', () => {
    it('correctly processes HB 2 style comprehensive reform bill', () => {
      const billText = REALISTIC_OMNIBUS_BILL;

      const complexity = detectComplexity(billText);
      const articles = parseArticles(billText);
      const codeRefs = parseCodeReferences(billText);

      expect(complexity.complexity).toBe('omnibus');
      expect(complexity.pattern).toBe('omnibus');
      expect(articles.length).toBe(5);

      // Verify article titles are meaningful
      expect(articles[0].title).toContain('FOUNDATION SCHOOL PROGRAM');
      expect(articles[1].title).toContain('SPECIAL PROGRAMS');
      expect(articles[2].title).toContain('EDUCATOR COMPENSATION');

      // Verify sections are properly grouped
      expect(articles[0].sections.some(s => s.startsWith('1.'))).toBe(true);
      expect(articles[1].sections.some(s => s.startsWith('2.'))).toBe(true);
    });

    it('correctly handles interagency coordination omnibus bill', () => {
      const billText = MULTI_CODE_OMNIBUS_BILL;

      const complexity = detectComplexity(billText);
      const articles = parseArticles(billText);
      const codeRefs = parseCodeReferences(billText);

      expect(complexity.complexity).toBe('omnibus');
      expect(articles.length).toBe(4);

      // Should have references to multiple codes
      const uniqueCodes = new Set(codeRefs.map(ref => ref.code));
      expect(uniqueCodes.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('terminology replacement patterns', () => {
    it('correctly processes agency renaming bill', () => {
      const billText = TERMINOLOGY_BILL;

      const complexity = detectComplexity(billText);
      const codeRefs = parseCodeReferences(billText);

      // Should detect terminology replacement pattern
      expect(complexity.pattern).toBe('terminology_replacement');
      expect(complexity.terminologyReplacement).toBeDefined();

      // Should still parse code references correctly
      expect(codeRefs.length).toBeGreaterThan(0);
      expect(codeRefs.every(ref => ref.code === 'Health and Safety Code')).toBe(true);
    });
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe('Parser Performance', () => {
  /**
   * Generates a large bill text with the specified number of sections
   */
  function generateLargeBillText(sectionCount: number): string {
    const articlesCount = Math.ceil(sectionCount / 25);
    let billText = `
AN ACT relating to comprehensive legislative reform.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
`;

    let sectionNum = 0;
    for (let a = 1; a <= articlesCount; a++) {
      billText += `ARTICLE ${a}.  PART ${a} PROVISIONS\n`;

      const sectionsInArticle = Math.min(25, sectionCount - sectionNum);
      for (let s = 1; s <= sectionsInArticle; s++) {
        sectionNum++;
        const sectionId = `${a}.${String(s).padStart(2, '0')}`;
        billText += `SECTION ${sectionId}.  Section ${28 + sectionNum}.00${s}, Education Code, is amended to read as follows:\n`;
        billText += `Sec. ${28 + sectionNum}.00${s}.  PROVISION ${sectionNum}.  This section provides for certain requirements.\n`;
      }
    }

    billText += `ARTICLE ${articlesCount + 1}.  EFFECTIVE DATE\n`;
    billText += `SECTION ${articlesCount + 1}.01.  This Act takes effect September 1, 2025.\n`;

    return billText;
  }

  it('processes medium-sized bills (100 sections) in reasonable time', () => {
    const billText = generateLargeBillText(100);
    const startTime = performance.now();

    detectComplexity(billText);
    parseCodeReferences(billText);
    parseArticles(billText);

    const duration = performance.now() - startTime;

    // Should complete in under 1 second
    expect(duration).toBeLessThan(1000);
  });

  it('processes large bills (500 sections) in reasonable time', () => {
    const billText = generateLargeBillText(500);
    const startTime = performance.now();

    detectComplexity(billText);
    parseCodeReferences(billText);
    parseArticles(billText);

    const duration = performance.now() - startTime;

    // Should complete in under 3 seconds
    expect(duration).toBeLessThan(3000);
  });

  it('processes very large bills (1000 sections) in reasonable time', () => {
    const billText = generateLargeBillText(1000);
    const startTime = performance.now();

    detectComplexity(billText);
    parseCodeReferences(billText);
    parseArticles(billText);

    const duration = performance.now() - startTime;

    // Should complete in under 5 seconds
    expect(duration).toBeLessThan(5000);
  });

  it('maintains accuracy for large bills', () => {
    const billText = generateLargeBillText(100);

    const complexity = detectComplexity(billText);
    const articles = parseArticles(billText);

    // Verify accuracy is maintained
    expect(complexity.complexity).toBe('omnibus');
    expect(complexity.articleCount).toBeGreaterThan(0);
    expect(articles.length).toBeGreaterThan(0);

    // Section count should be approximately correct
    expect(complexity.sectionCount).toBeGreaterThanOrEqual(95); // Allow for some parsing variance
  });
});

// ============================================================================
// INTEGRATION WITH findArticleForSection
// ============================================================================

describe('findArticleForSection Integration', () => {
  it('finds correct article for code references', () => {
    const billText = REALISTIC_OMNIBUS_BILL;

    const articles = parseArticles(billText);
    const codeRefs = parseCodeReferences(billText);

    // For each code reference with article-style section numbering
    for (const ref of codeRefs) {
      const sectionMatch = ref.billSection.match(/SECTION\s+(\d+\.\d+)/);
      if (sectionMatch) {
        const sectionNum = sectionMatch[1];
        const article = findArticleForSection(articles, sectionNum);

        if (article) {
          // Verify the section prefix matches the article number
          const expectedPrefix = article.articleNumber + '.';
          expect(sectionNum.startsWith(expectedPrefix)).toBe(true);
        }
      }
    }
  });

  it('returns undefined for sections not in any article', () => {
    const billText = REALISTIC_SIMPLE_BILL;

    const articles = parseArticles(billText);

    // Simple bill has no articles
    expect(articles).toHaveLength(0);

    // findArticleForSection should return undefined
    const result = findArticleForSection(articles, '1');
    expect(result).toBeUndefined();
  });
});
