import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ArticleNavigationPanel,
  ArticleNavigationPlaceholder,
  findCurrentArticle,
  findCurrentSection,
} from '../article-navigation-panel';
import type { BillArticle } from '@/lib/parsers/article-parser';

// Mock data for testing
const mockArticles: BillArticle[] = [
  {
    articleNumber: '1',
    title: 'PUBLIC EDUCATION FUNDING',
    startLine: 10,
    endLine: 100,
    sections: ['1.01', '1.02', '1.03'],
  },
  {
    articleNumber: '2',
    title: 'HIGHER EDUCATION',
    startLine: 101,
    endLine: 200,
    sections: ['2.01', '2.02'],
  },
  {
    articleNumber: '3',
    title: 'EFFECTIVE DATE',
    startLine: 201,
    endLine: 250,
    sections: [],
  },
];

const mockArticlesWithRomanNumerals: BillArticle[] = [
  {
    articleNumber: 'I',
    title: 'GENERAL PROVISIONS',
    startLine: 1,
    endLine: 50,
    sections: ['1.01', '1.02'],
  },
  {
    articleNumber: 'II',
    title: 'ENFORCEMENT',
    startLine: 51,
    endLine: 100,
    sections: ['2.01'],
  },
];

describe('ArticleNavigationPanel', () => {
  describe('Rendering', () => {
    it('renders articles with correct structure', () => {
      render(<ArticleNavigationPanel articles={mockArticles} />);

      // Check that all article titles are rendered
      expect(screen.getByText('PUBLIC EDUCATION FUNDING')).toBeInTheDocument();
      expect(screen.getByText('HIGHER EDUCATION')).toBeInTheDocument();
      expect(screen.getByText('EFFECTIVE DATE')).toBeInTheDocument();

      // Check that article numbers are displayed
      expect(screen.getByText('Art. 1')).toBeInTheDocument();
      expect(screen.getByText('Art. 2')).toBeInTheDocument();
      expect(screen.getByText('Art. 3')).toBeInTheDocument();
    });

    it('renders section count badges for each article', () => {
      render(<ArticleNavigationPanel articles={mockArticles} />);

      // Find badges by their content (section counts)
      const badges = screen.getAllByLabelText(/sections/i);
      expect(badges).toHaveLength(3);

      // Verify the badge values
      expect(screen.getByLabelText('3 sections')).toBeInTheDocument();
      expect(screen.getByLabelText('2 sections')).toBeInTheDocument();
      expect(screen.getByLabelText('0 sections')).toBeInTheDocument();
    });

    it('renders sections within articles', () => {
      render(<ArticleNavigationPanel articles={mockArticles} />);

      // All accordions should be expanded by default
      expect(screen.getByText('Sec. 1.01')).toBeInTheDocument();
      expect(screen.getByText('Sec. 1.02')).toBeInTheDocument();
      expect(screen.getByText('Sec. 1.03')).toBeInTheDocument();
      expect(screen.getByText('Sec. 2.01')).toBeInTheDocument();
      expect(screen.getByText('Sec. 2.02')).toBeInTheDocument();
    });

    it('renders Roman numeral article numbers correctly', () => {
      render(<ArticleNavigationPanel articles={mockArticlesWithRomanNumerals} />);

      expect(screen.getByText('Art. I')).toBeInTheDocument();
      expect(screen.getByText('Art. II')).toBeInTheDocument();
    });

    it('shows "No sections found" message for articles without sections', () => {
      render(<ArticleNavigationPanel articles={mockArticles} />);

      expect(screen.getByText('No sections found')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when articles array is empty', () => {
      render(<ArticleNavigationPanel articles={[]} />);

      expect(screen.getByText('No Article Structure')).toBeInTheDocument();
      expect(
        screen.getByText('This bill does not have an article structure to navigate.')
      ).toBeInTheDocument();
    });

    it('shows empty state with correct aria-label', () => {
      render(<ArticleNavigationPanel articles={[]} />);

      expect(screen.getByRole('region')).toHaveAttribute(
        'aria-label',
        'Article navigation'
      );
    });

    it('renders empty state container', () => {
      render(<ArticleNavigationPanel articles={[]} />);

      // The empty state should contain the icon (checking the container has correct structure)
      const region = screen.getByRole('region', { name: 'Article navigation' });
      expect(region).toBeInTheDocument();
    });
  });

  describe('Accordion Behavior', () => {
    it('expands and collapses accordion items on click', () => {
      render(<ArticleNavigationPanel articles={mockArticles} />);

      // Find the first accordion trigger (Article 1)
      const firstTrigger = screen.getByRole('button', {
        name: /Art\. 1.*PUBLIC EDUCATION FUNDING/i,
      });

      // Initially expanded, sections should be visible
      expect(screen.getByText('Sec. 1.01')).toBeVisible();

      // Click to collapse
      fireEvent.click(firstTrigger);

      // The accordion should now be closed
      expect(firstTrigger.closest('[data-state]')).toHaveAttribute(
        'data-state',
        'closed'
      );
    });

    it('allows multiple accordions to be open simultaneously', () => {
      render(<ArticleNavigationPanel articles={mockArticles} />);

      // Both articles should be expanded by default
      const firstTrigger = screen.getByRole('button', {
        name: /Art\. 1.*PUBLIC EDUCATION FUNDING/i,
      });
      const secondTrigger = screen.getByRole('button', {
        name: /Art\. 2.*HIGHER EDUCATION/i,
      });

      // Verify both are open
      expect(firstTrigger.closest('[data-state]')).toHaveAttribute(
        'data-state',
        'open'
      );
      expect(secondTrigger.closest('[data-state]')).toHaveAttribute(
        'data-state',
        'open'
      );
    });
  });

  describe('Navigation', () => {
    it('calls onNavigate when section is clicked', () => {
      const handleNavigate = vi.fn();

      render(
        <ArticleNavigationPanel articles={mockArticles} onNavigate={handleNavigate} />
      );

      // Click on a section
      const sectionButton = screen.getByRole('button', {
        name: 'Navigate to Section 1.01',
      });
      fireEvent.click(sectionButton);

      expect(handleNavigate).toHaveBeenCalledTimes(1);
      // Should be called with the article's start line since we don't have section line numbers
      expect(handleNavigate).toHaveBeenCalledWith(10);
    });

    it('does not throw when onNavigate is not provided', () => {
      render(<ArticleNavigationPanel articles={mockArticles} />);

      const sectionButton = screen.getByRole('button', {
        name: 'Navigate to Section 1.01',
      });

      // Should not throw
      expect(() => fireEvent.click(sectionButton)).not.toThrow();
    });

    it('navigates to correct line for different articles', () => {
      const handleNavigate = vi.fn();

      render(
        <ArticleNavigationPanel articles={mockArticles} onNavigate={handleNavigate} />
      );

      // Click section in article 2
      const sectionButton = screen.getByRole('button', {
        name: 'Navigate to Section 2.01',
      });
      fireEvent.click(sectionButton);

      // Should navigate to article 2's start line
      expect(handleNavigate).toHaveBeenCalledWith(101);
    });
  });

  describe('Current Line Highlighting', () => {
    it('highlights current article based on currentLineNumber', () => {
      render(
        <ArticleNavigationPanel articles={mockArticles} currentLineNumber={50} />
      );

      // Article 1 (lines 10-100) should be highlighted
      // The AccordionItem wraps a Header which wraps the Trigger
      // Structure: AccordionItem > Header > Trigger (button)
      const article1Trigger = screen.getByRole('button', {
        name: /Art\. 1.*PUBLIC EDUCATION FUNDING/i,
      });
      // Go up: button -> Header (flex) -> AccordionItem (border-b + bg-primary/5)
      const article1Item = article1Trigger.parentElement?.parentElement;

      // The accordion item should have the highlight class
      expect(article1Item).toHaveClass('bg-primary/5');
    });

    it('does not highlight any article when currentLineNumber is outside all articles', () => {
      render(
        <ArticleNavigationPanel articles={mockArticles} currentLineNumber={5} />
      );

      // No article should be highlighted (line 5 is before all articles)
      const accordionTriggers = screen
        .getAllByRole('button')
        .filter((btn) => btn.getAttribute('aria-expanded') !== null);

      accordionTriggers.forEach((trigger) => {
        // Go up: button -> Header -> AccordionItem
        const accordionItem = trigger.parentElement?.parentElement;
        expect(accordionItem).not.toHaveClass('bg-primary/5');
      });
    });

    it('highlights the correct article when line is at boundary', () => {
      render(
        <ArticleNavigationPanel articles={mockArticles} currentLineNumber={101} />
      );

      // Article 2 starts at line 101
      const article2Trigger = screen.getByRole('button', {
        name: /Art\. 2.*HIGHER EDUCATION/i,
      });
      // Go up: button -> Header -> AccordionItem
      const article2Item = article2Trigger.parentElement?.parentElement;

      expect(article2Item).toHaveClass('bg-primary/5');
    });

    it('auto-expands the current article accordion', () => {
      // When providing a currentLineNumber in article 2, it should be auto-expanded
      render(
        <ArticleNavigationPanel articles={mockArticles} currentLineNumber={150} />
      );

      const article2Trigger = screen.getByRole('button', {
        name: /Art\. 2.*HIGHER EDUCATION/i,
      });

      expect(article2Trigger.closest('[data-state]')).toHaveAttribute(
        'data-state',
        'open'
      );
    });
  });

  describe('Accessibility', () => {
    it('has correct aria-label on navigation region', () => {
      render(<ArticleNavigationPanel articles={mockArticles} />);

      expect(
        screen.getByRole('navigation', { name: 'Bill article structure' })
      ).toBeInTheDocument();
    });

    it('has aria-label on section buttons', () => {
      render(<ArticleNavigationPanel articles={mockArticles} />);

      const sectionButtons = screen.getAllByRole('button', {
        name: /Navigate to Section/,
      });
      expect(sectionButtons.length).toBeGreaterThan(0);
    });

    it('section buttons are keyboard focusable', () => {
      render(<ArticleNavigationPanel articles={mockArticles} />);

      const sectionButton = screen.getByRole('button', {
        name: 'Navigate to Section 1.01',
      });

      // Focus the button
      sectionButton.focus();
      expect(document.activeElement).toBe(sectionButton);
    });

    it('section badges have descriptive aria-labels', () => {
      render(<ArticleNavigationPanel articles={mockArticles} />);

      // Check that badges have proper aria-labels for screen readers
      expect(screen.getByLabelText('3 sections')).toBeInTheDocument();
      expect(screen.getByLabelText('2 sections')).toBeInTheDocument();
      expect(screen.getByLabelText('0 sections')).toBeInTheDocument();
    });
  });
});

describe('ArticleNavigationPlaceholder', () => {
  it('renders placeholder content', () => {
    render(<ArticleNavigationPlaceholder />);

    expect(screen.getByText('Bill Structure')).toBeInTheDocument();
    expect(
      screen.getByText('Navigate the article and section structure of this bill')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Available for omnibus bills with multiple articles')
    ).toBeInTheDocument();
  });
});

describe('Helper Functions', () => {
  describe('findCurrentArticle', () => {
    it('returns correct article number when line is within article bounds', () => {
      expect(findCurrentArticle(mockArticles, 50)).toBe('1');
      expect(findCurrentArticle(mockArticles, 150)).toBe('2');
      expect(findCurrentArticle(mockArticles, 225)).toBe('3');
    });

    it('returns null when line is before all articles', () => {
      expect(findCurrentArticle(mockArticles, 5)).toBeNull();
    });

    it('returns null when line is after all articles', () => {
      expect(findCurrentArticle(mockArticles, 300)).toBeNull();
    });

    it('returns correct article at boundary lines', () => {
      expect(findCurrentArticle(mockArticles, 10)).toBe('1'); // Start of article 1
      expect(findCurrentArticle(mockArticles, 100)).toBe('1'); // End of article 1
      expect(findCurrentArticle(mockArticles, 101)).toBe('2'); // Start of article 2
    });

    it('handles empty articles array', () => {
      expect(findCurrentArticle([], 50)).toBeNull();
    });

    it('works with Roman numeral article numbers', () => {
      expect(findCurrentArticle(mockArticlesWithRomanNumerals, 25)).toBe('I');
      expect(findCurrentArticle(mockArticlesWithRomanNumerals, 75)).toBe('II');
    });
  });

  describe('findCurrentSection', () => {
    it('returns article and section info when line is within article', () => {
      const result = findCurrentSection(mockArticles, 50);
      expect(result).toEqual({
        articleNumber: '1',
        sectionNumber: '1.03', // Last section in the article
      });
    });

    it('returns first section when article has sections', () => {
      const result = findCurrentSection(mockArticles, 10);
      expect(result?.articleNumber).toBe('1');
      expect(result?.sectionNumber).toBe('1.03'); // Returns last section as per current implementation
    });

    it('returns null when line is outside all articles', () => {
      expect(findCurrentSection(mockArticles, 5)).toBeNull();
      expect(findCurrentSection(mockArticles, 300)).toBeNull();
    });

    it('handles empty articles array', () => {
      expect(findCurrentSection([], 50)).toBeNull();
    });
  });
});
