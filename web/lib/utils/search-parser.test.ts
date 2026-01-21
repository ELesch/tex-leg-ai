import { describe, it, expect } from 'vitest';
import { parseSearchQuery, highlightSearchTerms } from './search-parser';

describe('parseSearchQuery', () => {
  describe('empty and basic queries', () => {
    it('returns empty array for empty string', () => {
      expect(parseSearchQuery('')).toEqual([]);
    });

    it('returns empty array for whitespace only', () => {
      expect(parseSearchQuery('   ')).toEqual([]);
    });

    it('returns single term condition for simple query', () => {
      const result = parseSearchQuery('education');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        OR: [
          { billId: { contains: 'education', mode: 'insensitive' } },
          { description: { contains: 'education', mode: 'insensitive' } },
        ],
      });
    });
  });

  describe('bill ID patterns', () => {
    it('parses HB bill ID pattern', () => {
      const result = parseSearchQuery('HB 123');
      expect(result).toEqual([
        {
          billId: {
            equals: 'HB 123',
            mode: 'insensitive',
          },
        },
      ]);
    });

    it('parses SB bill ID pattern', () => {
      const result = parseSearchQuery('SB 45');
      expect(result).toEqual([
        {
          billId: {
            equals: 'SB 45',
            mode: 'insensitive',
          },
        },
      ]);
    });

    it('parses HJR bill ID pattern', () => {
      const result = parseSearchQuery('HJR 10');
      expect(result).toEqual([
        {
          billId: {
            equals: 'HJR 10',
            mode: 'insensitive',
          },
        },
      ]);
    });

    it('parses SJR bill ID pattern', () => {
      const result = parseSearchQuery('SJR 5');
      expect(result).toEqual([
        {
          billId: {
            equals: 'SJR 5',
            mode: 'insensitive',
          },
        },
      ]);
    });

    it('parses HCR bill ID pattern', () => {
      const result = parseSearchQuery('HCR 12');
      expect(result).toEqual([
        {
          billId: {
            equals: 'HCR 12',
            mode: 'insensitive',
          },
        },
      ]);
    });

    it('parses SCR bill ID pattern', () => {
      const result = parseSearchQuery('SCR 8');
      expect(result).toEqual([
        {
          billId: {
            equals: 'SCR 8',
            mode: 'insensitive',
          },
        },
      ]);
    });

    it('handles bill ID without space', () => {
      const result = parseSearchQuery('HB123');
      expect(result).toEqual([
        {
          billId: {
            equals: 'HB 123',
            mode: 'insensitive',
          },
        },
      ]);
    });

    it('handles lowercase bill ID', () => {
      const result = parseSearchQuery('hb 456');
      expect(result).toEqual([
        {
          billId: {
            equals: 'HB 456',
            mode: 'insensitive',
          },
        },
      ]);
    });

    it('handles leading zeros in bill number', () => {
      const result = parseSearchQuery('HB 0123');
      expect(result).toEqual([
        {
          billId: {
            equals: 'HB 123',
            mode: 'insensitive',
          },
        },
      ]);
    });
  });

  describe('AND queries', () => {
    it('parses AND query with two terms', () => {
      const result = parseSearchQuery('education AND funding');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        OR: [
          { billId: { contains: 'education', mode: 'insensitive' } },
          { description: { contains: 'education', mode: 'insensitive' } },
        ],
      });
      expect(result[1]).toEqual({
        OR: [
          { billId: { contains: 'funding', mode: 'insensitive' } },
          { description: { contains: 'funding', mode: 'insensitive' } },
        ],
      });
    });

    it('parses AND query with multiple terms', () => {
      const result = parseSearchQuery('education AND funding AND schools');
      expect(result).toHaveLength(3);
    });

    it('handles lowercase and', () => {
      const result = parseSearchQuery('education and funding');
      expect(result).toHaveLength(2);
    });
  });

  describe('OR queries', () => {
    it('parses OR query with two terms', () => {
      const result = parseSearchQuery('education OR schools');
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('OR');
      expect(result[0].OR).toHaveLength(2);
    });

    it('parses OR query with multiple terms', () => {
      const result = parseSearchQuery('education OR schools OR teachers');
      expect(result).toHaveLength(1);
      expect(result[0].OR).toHaveLength(3);
    });

    it('handles lowercase or', () => {
      const result = parseSearchQuery('education or schools');
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('OR');
    });
  });

  describe('NOT queries', () => {
    it('parses NOT query with single exclusion', () => {
      const result = parseSearchQuery('education NOT tax');
      expect(result).toHaveLength(2);
      // First condition: includes education
      expect(result[0]).toEqual({
        OR: [
          { billId: { contains: 'education', mode: 'insensitive' } },
          { description: { contains: 'education', mode: 'insensitive' } },
        ],
      });
      // Second condition: excludes tax
      expect(result[1]).toEqual({
        AND: [
          { billId: { not: { contains: 'tax' }, mode: 'insensitive' } },
          { description: { not: { contains: 'tax' }, mode: 'insensitive' } },
        ],
      });
    });

    it('parses NOT query with multiple exclusions', () => {
      const result = parseSearchQuery('education NOT tax NOT fees');
      expect(result).toHaveLength(3);
    });

    it('handles lowercase not', () => {
      const result = parseSearchQuery('education not tax');
      expect(result).toHaveLength(2);
    });
  });

  describe('complex queries', () => {
    it('parses AND with NOT', () => {
      const result = parseSearchQuery('education AND funding NOT tax');
      expect(result).toHaveLength(3);
    });

    it('parses OR with NOT', () => {
      const result = parseSearchQuery('education OR schools NOT tax');
      expect(result).toHaveLength(2);
      // First: OR condition
      expect(result[0]).toHaveProperty('OR');
      // Second: NOT condition
      expect(result[1]).toHaveProperty('AND');
    });
  });
});

describe('highlightSearchTerms', () => {
  it('returns original text when query is empty', () => {
    expect(highlightSearchTerms('Some text here', '')).toBe('Some text here');
  });

  it('highlights single term', () => {
    const result = highlightSearchTerms('Education is important', 'education');
    expect(result).toBe('<mark>Education</mark> is important');
  });

  it('highlights multiple occurrences', () => {
    const result = highlightSearchTerms('Education for education', 'education');
    expect(result).toBe('<mark>Education</mark> for <mark>education</mark>');
  });

  it('highlights multiple different terms', () => {
    const result = highlightSearchTerms('Education and funding', 'education funding');
    expect(result).toBe('<mark>Education</mark> and <mark>funding</mark>');
  });

  it('ignores short terms (2 chars or less)', () => {
    const result = highlightSearchTerms('A is for apple', 'A is');
    expect(result).toBe('A is for apple');
  });

  it('ignores operators in query', () => {
    const result = highlightSearchTerms('Education funding', 'education AND funding');
    expect(result).toBe('<mark>Education</mark> <mark>funding</mark>');
  });

  it('handles special regex characters safely', () => {
    const result = highlightSearchTerms('test (value)', '(value)');
    expect(result).toBe('test <mark>(value)</mark>');
  });

  it('is case insensitive', () => {
    const result = highlightSearchTerms('EDUCATION funding', 'education');
    expect(result).toBe('<mark>EDUCATION</mark> funding');
  });
});
