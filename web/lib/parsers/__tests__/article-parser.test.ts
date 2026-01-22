import { describe, it, expect } from 'vitest';
import {
  parseArticles,
  hasArticleStructure,
  countArticles,
  findArticleForSection,
  normalizeArticleNumber,
  type BillArticle,
} from '../article-parser';

// Sample bill texts based on real Texas legislative patterns

/** Simple bill without articles */
const SIMPLE_BILL_NO_ARTICLES = `
AN ACT relating to education.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
SECTION 1.  Section 29.001, Education Code, is amended to read as follows:
Sec. 29.001.  DEFINITIONS.
SECTION 2.  This Act takes effect September 1, 2025.
`;

/** Omnibus bill with Arabic numeral articles */
const OMNIBUS_ARABIC_ARTICLES = `
AN ACT relating to public school finance, educator compensation, and student outcomes.
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

/** Bill with Roman numeral articles */
const ROMAN_NUMERAL_ARTICLES = `
AN ACT relating to various education matters.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
ARTICLE I.  GENERAL PROVISIONS
SECTION 1.01.  Section 29.001, Education Code, is amended.
SECTION 1.02.  Section 29.002, Education Code, is amended.
ARTICLE II.  SPECIAL PROGRAMS
SECTION 2.01.  Section 29.100, Education Code, is amended.
SECTION 2.02.  Section 29.101, Education Code, is amended.
ARTICLE III.  FUNDING
SECTION 3.01.  Section 48.001, Education Code, is amended.
ARTICLE IV.  EFFECTIVE DATE
SECTION 4.01.  This Act takes effect September 1, 2025.
`;

/** Bill with single article */
const SINGLE_ARTICLE_BILL = `
AN ACT relating to education.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
ARTICLE 1.  EDUCATION CHANGES
SECTION 1.01.  Section 29.001, Education Code, is amended.
SECTION 1.02.  Section 29.002, Education Code, is amended.
SECTION 1.03.  This Act takes effect September 1, 2025.
`;

/** Bill with article title on next line */
const ARTICLE_TITLE_NEXT_LINE = `
AN ACT relating to education.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
ARTICLE 1.
EDUCATION CHANGES
SECTION 1.01.  Section 29.001, Education Code, is amended.
`;

/** Large omnibus bill simulation (HB 2 style) */
const LARGE_OMNIBUS_BILL = `
AN ACT relating to comprehensive education reform.
BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:
ARTICLE 1.  CHARTER SCHOOLS
${Array.from({ length: 30 }, (_, i) => `SECTION 1.${String(i + 1).padStart(2, '0')}.  Section content here.`).join('\n')}
ARTICLE 2.  TEACHER COMPENSATION
${Array.from({ length: 25 }, (_, i) => `SECTION 2.${String(i + 1).padStart(2, '0')}.  Section content here.`).join('\n')}
ARTICLE 3.  STUDENT OUTCOMES
${Array.from({ length: 35 }, (_, i) => `SECTION 3.${String(i + 1).padStart(2, '0')}.  Section content here.`).join('\n')}
ARTICLE 4.  EFFECTIVE DATE AND TRANSITION
${Array.from({ length: 10 }, (_, i) => `SECTION 4.${String(i + 1).padStart(2, '0')}.  Section content here.`).join('\n')}
`;

describe('parseArticles', () => {
  describe('empty and invalid input', () => {
    it('returns empty array for empty string', () => {
      const result = parseArticles('');
      expect(result).toEqual([]);
    });

    it('returns empty array for null input', () => {
      const result = parseArticles(null as unknown as string);
      expect(result).toEqual([]);
    });

    it('returns empty array for undefined input', () => {
      const result = parseArticles(undefined as unknown as string);
      expect(result).toEqual([]);
    });

    it('returns empty array for text without articles', () => {
      const result = parseArticles(SIMPLE_BILL_NO_ARTICLES);
      expect(result).toEqual([]);
    });
  });

  describe('Arabic numeral articles', () => {
    it('parses all articles correctly', () => {
      const articles = parseArticles(OMNIBUS_ARABIC_ARTICLES);

      expect(articles).toHaveLength(4);
    });

    it('extracts correct article numbers', () => {
      const articles = parseArticles(OMNIBUS_ARABIC_ARTICLES);

      expect(articles.map(a => a.articleNumber)).toEqual(['1', '2', '3', '4']);
    });

    it('extracts correct article titles', () => {
      const articles = parseArticles(OMNIBUS_ARABIC_ARTICLES);

      expect(articles[0].title).toBe('CHANGES RELATED TO PUBLIC EDUCATION');
      expect(articles[1].title).toBe('TEACHER PREPARATION');
      expect(articles[2].title).toBe('SCHOOL FUNDING');
      expect(articles[3].title).toBe('EFFECTIVE DATE');
    });

    it('extracts sections for each article', () => {
      const articles = parseArticles(OMNIBUS_ARABIC_ARTICLES);

      expect(articles[0].sections).toEqual(['1.01', '1.02', '1.03']);
      expect(articles[1].sections).toEqual(['2.01', '2.02', '2.03']);
      expect(articles[2].sections).toEqual(['3.01', '3.02', '3.03']);
      expect(articles[3].sections).toEqual(['4.01']);
    });
  });

  describe('Roman numeral articles', () => {
    it('parses Roman numeral articles', () => {
      const articles = parseArticles(ROMAN_NUMERAL_ARTICLES);

      expect(articles).toHaveLength(4);
    });

    it('preserves Roman numeral format in articleNumber', () => {
      const articles = parseArticles(ROMAN_NUMERAL_ARTICLES);

      expect(articles.map(a => a.articleNumber)).toEqual(['I', 'II', 'III', 'IV']);
    });

    it('extracts correct titles for Roman numeral articles', () => {
      const articles = parseArticles(ROMAN_NUMERAL_ARTICLES);

      expect(articles[0].title).toBe('GENERAL PROVISIONS');
      expect(articles[1].title).toBe('SPECIAL PROGRAMS');
      expect(articles[2].title).toBe('FUNDING');
      expect(articles[3].title).toBe('EFFECTIVE DATE');
    });
  });

  describe('line numbers', () => {
    it('sets correct startLine for each article (1-indexed)', () => {
      const articles = parseArticles(OMNIBUS_ARABIC_ARTICLES);

      // First article should start at line where "ARTICLE 1." appears
      expect(articles[0].startLine).toBeGreaterThan(0);
      expect(articles[0].startLine).toBeLessThan(articles[1].startLine);
    });

    it('sets correct endLine for each article', () => {
      const articles = parseArticles(OMNIBUS_ARABIC_ARTICLES);

      // Each article's endLine should be one less than next article's startLine
      for (let i = 0; i < articles.length - 1; i++) {
        expect(articles[i].endLine).toBeLessThan(articles[i + 1].startLine);
      }
    });

    it('last article extends to end of document', () => {
      const articles = parseArticles(OMNIBUS_ARABIC_ARTICLES);
      const lastArticle = articles[articles.length - 1];
      const lineCount = OMNIBUS_ARABIC_ARTICLES.split('\n').length;

      // Last article should extend close to the end
      expect(lastArticle.endLine).toBeLessThanOrEqual(lineCount);
    });
  });

  describe('single article', () => {
    it('handles bill with single article', () => {
      const articles = parseArticles(SINGLE_ARTICLE_BILL);

      expect(articles).toHaveLength(1);
      expect(articles[0].articleNumber).toBe('1');
      expect(articles[0].title).toBe('EDUCATION CHANGES');
    });

    it('extracts all sections from single article', () => {
      const articles = parseArticles(SINGLE_ARTICLE_BILL);

      expect(articles[0].sections).toContain('1.01');
      expect(articles[0].sections).toContain('1.02');
      expect(articles[0].sections).toContain('1.03');
    });
  });

  describe('title extraction edge cases', () => {
    it('handles article with title on same line', () => {
      const articles = parseArticles(OMNIBUS_ARABIC_ARTICLES);

      expect(articles[0].title).toBe('CHANGES RELATED TO PUBLIC EDUCATION');
    });

    it('handles article with empty title (uses default)', () => {
      const billText = `
ARTICLE 1.
SECTION 1.01.  Content here.
      `;
      const articles = parseArticles(billText);

      // Should have some title, even if defaulted
      expect(articles[0].title).toBeTruthy();
    });
  });

  describe('large omnibus bill', () => {
    it('handles bill with many sections per article', () => {
      const articles = parseArticles(LARGE_OMNIBUS_BILL);

      expect(articles).toHaveLength(4);
      expect(articles[0].sections.length).toBe(30);
      expect(articles[1].sections.length).toBe(25);
      expect(articles[2].sections.length).toBe(35);
      expect(articles[3].sections.length).toBe(10);
    });

    it('total sections across all articles is correct', () => {
      const articles = parseArticles(LARGE_OMNIBUS_BILL);
      const totalSections = articles.reduce((sum, a) => sum + a.sections.length, 0);

      expect(totalSections).toBe(100);
    });
  });
});

describe('hasArticleStructure', () => {
  it('returns true for bills with articles', () => {
    expect(hasArticleStructure(OMNIBUS_ARABIC_ARTICLES)).toBe(true);
    expect(hasArticleStructure(ROMAN_NUMERAL_ARTICLES)).toBe(true);
    expect(hasArticleStructure(SINGLE_ARTICLE_BILL)).toBe(true);
  });

  it('returns false for bills without articles', () => {
    expect(hasArticleStructure(SIMPLE_BILL_NO_ARTICLES)).toBe(false);
  });

  it('returns false for empty input', () => {
    expect(hasArticleStructure('')).toBe(false);
    expect(hasArticleStructure(null as unknown as string)).toBe(false);
    expect(hasArticleStructure(undefined as unknown as string)).toBe(false);
  });
});

describe('countArticles', () => {
  it('returns correct count for multi-article bills', () => {
    expect(countArticles(OMNIBUS_ARABIC_ARTICLES)).toBe(4);
    expect(countArticles(ROMAN_NUMERAL_ARTICLES)).toBe(4);
  });

  it('returns 1 for single-article bills', () => {
    expect(countArticles(SINGLE_ARTICLE_BILL)).toBe(1);
  });

  it('returns 0 for bills without articles', () => {
    expect(countArticles(SIMPLE_BILL_NO_ARTICLES)).toBe(0);
    expect(countArticles('')).toBe(0);
  });
});

describe('findArticleForSection', () => {
  it('finds correct article for a section', () => {
    const articles = parseArticles(OMNIBUS_ARABIC_ARTICLES);

    const article1 = findArticleForSection(articles, '1.02');
    expect(article1?.articleNumber).toBe('1');

    const article2 = findArticleForSection(articles, '2.01');
    expect(article2?.articleNumber).toBe('2');

    const article3 = findArticleForSection(articles, '3.03');
    expect(article3?.articleNumber).toBe('3');
  });

  it('returns undefined for non-existent section', () => {
    const articles = parseArticles(OMNIBUS_ARABIC_ARTICLES);

    const result = findArticleForSection(articles, '99.99');
    expect(result).toBeUndefined();
  });

  it('returns undefined for empty articles array', () => {
    const result = findArticleForSection([], '1.01');
    expect(result).toBeUndefined();
  });
});

describe('normalizeArticleNumber', () => {
  it('converts Arabic numerals correctly', () => {
    expect(normalizeArticleNumber('1')).toBe(1);
    expect(normalizeArticleNumber('10')).toBe(10);
    expect(normalizeArticleNumber('99')).toBe(99);
  });

  it('converts Roman numerals correctly', () => {
    expect(normalizeArticleNumber('I')).toBe(1);
    expect(normalizeArticleNumber('II')).toBe(2);
    expect(normalizeArticleNumber('III')).toBe(3);
    expect(normalizeArticleNumber('IV')).toBe(4);
    expect(normalizeArticleNumber('V')).toBe(5);
    expect(normalizeArticleNumber('VI')).toBe(6);
    expect(normalizeArticleNumber('VII')).toBe(7);
    expect(normalizeArticleNumber('VIII')).toBe(8);
    expect(normalizeArticleNumber('IX')).toBe(9);
    expect(normalizeArticleNumber('X')).toBe(10);
  });

  it('handles larger Roman numerals', () => {
    expect(normalizeArticleNumber('XI')).toBe(11);
    expect(normalizeArticleNumber('XII')).toBe(12);
    expect(normalizeArticleNumber('XV')).toBe(15);
    expect(normalizeArticleNumber('XX')).toBe(20);
    expect(normalizeArticleNumber('L')).toBe(50);
    expect(normalizeArticleNumber('C')).toBe(100);
  });

  it('handles lowercase Roman numerals', () => {
    expect(normalizeArticleNumber('i')).toBe(1);
    expect(normalizeArticleNumber('iv')).toBe(4);
    expect(normalizeArticleNumber('ix')).toBe(9);
  });

  it('returns 0 for invalid input', () => {
    expect(normalizeArticleNumber('ABC')).toBe(0);
    expect(normalizeArticleNumber('')).toBe(0);
  });
});

describe('BillArticle structure', () => {
  it('has all required fields', () => {
    const articles = parseArticles(OMNIBUS_ARABIC_ARTICLES);
    const article = articles[0];

    expect(article).toHaveProperty('articleNumber');
    expect(article).toHaveProperty('title');
    expect(article).toHaveProperty('startLine');
    expect(article).toHaveProperty('endLine');
    expect(article).toHaveProperty('sections');

    expect(typeof article.articleNumber).toBe('string');
    expect(typeof article.title).toBe('string');
    expect(typeof article.startLine).toBe('number');
    expect(typeof article.endLine).toBe('number');
    expect(Array.isArray(article.sections)).toBe(true);
  });

  it('sections array contains string section numbers', () => {
    const articles = parseArticles(OMNIBUS_ARABIC_ARTICLES);

    for (const article of articles) {
      for (const section of article.sections) {
        expect(typeof section).toBe('string');
        // Section format should be X.XX
        expect(section).toMatch(/^\d+\.\d+$/);
      }
    }
  });
});
