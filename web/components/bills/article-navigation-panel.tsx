'use client';

import * as React from 'react';
import { FileText } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { BillArticle } from '@/lib/parsers/article-parser';

export interface ArticleNavigationPanelProps {
  /** Array of parsed articles from the bill */
  articles: BillArticle[];
  /** Callback when user clicks on a section to navigate */
  onNavigate?: (lineNumber: number) => void;
  /** Current line number being viewed (used for highlighting) */
  currentLineNumber?: number;
}

/**
 * Finds the current section based on line number
 */
export function findCurrentSection(
  articles: BillArticle[],
  currentLineNumber: number
): { articleNumber: string; sectionNumber: string } | null {
  for (const article of articles) {
    if (
      currentLineNumber >= article.startLine &&
      currentLineNumber <= article.endLine
    ) {
      // Find the section that contains the current line
      // Since sections only have section numbers, we need to find the closest section
      // that starts before or at the current line
      for (let i = article.sections.length - 1; i >= 0; i--) {
        return {
          articleNumber: article.articleNumber,
          sectionNumber: article.sections[i],
        };
      }
      // If no sections, just return the article
      if (article.sections.length > 0) {
        return {
          articleNumber: article.articleNumber,
          sectionNumber: article.sections[0],
        };
      }
    }
  }
  return null;
}

/**
 * Finds the article that contains the current line number
 */
export function findCurrentArticle(
  articles: BillArticle[],
  currentLineNumber: number
): string | null {
  for (const article of articles) {
    if (
      currentLineNumber >= article.startLine &&
      currentLineNumber <= article.endLine
    ) {
      return article.articleNumber;
    }
  }
  return null;
}

/**
 * ArticleNavigationPanel - A navigation component for bill articles
 *
 * Displays the article structure of a bill using an accordion layout,
 * allowing users to navigate to specific sections within the bill text.
 */
export function ArticleNavigationPanel({
  articles,
  onNavigate,
  currentLineNumber,
}: ArticleNavigationPanelProps) {
  // Find the current article for auto-expanding
  const currentArticle = currentLineNumber
    ? findCurrentArticle(articles, currentLineNumber)
    : null;

  // Track which accordions are open (default to all open, or current if line number provided)
  const [openItems, setOpenItems] = React.useState<string[]>(() => {
    if (currentArticle) {
      return [`article-${currentArticle}`];
    }
    // Default to having all articles expanded
    return articles.map((a) => `article-${a.articleNumber}`);
  });

  // Update open items when currentLineNumber changes to ensure current article is visible
  React.useEffect(() => {
    if (currentArticle && !openItems.includes(`article-${currentArticle}`)) {
      setOpenItems((prev) => [...prev, `article-${currentArticle}`]);
    }
  }, [currentArticle, openItems]);

  // Empty state
  if (!articles || articles.length === 0) {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center p-6 text-center"
        role="region"
        aria-label="Article navigation"
      >
        <FileText className="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
        <p className="font-medium">No Article Structure</p>
        <p className="mt-2 text-sm text-muted-foreground">
          This bill does not have an article structure to navigate.
        </p>
      </div>
    );
  }

  const handleSectionClick = (lineNumber: number) => {
    onNavigate?.(lineNumber);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4" role="navigation" aria-label="Bill article structure">
        <Accordion
          type="multiple"
          value={openItems}
          onValueChange={setOpenItems}
          className="w-full"
        >
          {articles.map((article) => {
            const isCurrentArticle = currentArticle === article.articleNumber;

            return (
              <AccordionItem
                key={`article-${article.articleNumber}`}
                value={`article-${article.articleNumber}`}
                className={cn(
                  'border-b last:border-b-0',
                  isCurrentArticle && 'bg-primary/5'
                )}
              >
                <AccordionTrigger
                  className={cn(
                    'gap-2 py-3 text-sm hover:no-underline hover:bg-muted/50',
                    isCurrentArticle && 'text-primary font-semibold'
                  )}
                >
                  <div className="flex flex-1 items-center gap-2 text-left">
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      Art. {article.articleNumber}
                    </span>
                    <span className="line-clamp-2 flex-1">
                      {article.title}
                    </span>
                    <Badge
                      variant="secondary"
                      className="ml-auto shrink-0"
                      aria-label={`${article.sections.length} sections`}
                    >
                      {article.sections.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-1 pl-4">
                    {article.sections.length === 0 ? (
                      <p className="py-2 text-sm text-muted-foreground italic">
                        No sections found
                      </p>
                    ) : (
                      article.sections.map((sectionNumber) => {
                        // For now, we don't have line numbers for individual sections
                        // We'll navigate to the article start line
                        const isCurrentSection = false; // Would need section line numbers to implement

                        return (
                          <button
                            key={`section-${article.articleNumber}-${sectionNumber}`}
                            type="button"
                            onClick={() => handleSectionClick(article.startLine)}
                            className={cn(
                              'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                              'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                              isCurrentSection && 'bg-primary/10 text-primary font-medium'
                            )}
                            aria-label={`Navigate to Section ${sectionNumber}`}
                            aria-current={isCurrentSection ? 'true' : undefined}
                          >
                            <span className="font-mono text-xs text-muted-foreground">
                              Sec. {sectionNumber}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </ScrollArea>
  );
}

/**
 * Placeholder component shown when no articles panel is provided
 */
export function ArticleNavigationPlaceholder() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <FileText className="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
      <p className="font-medium">Bill Structure</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Navigate the article and section structure of this bill
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Available for omnibus bills with multiple articles
      </p>
    </div>
  );
}
