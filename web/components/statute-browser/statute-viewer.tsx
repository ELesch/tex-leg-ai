'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Scale, History, ExternalLink, ArrowRight } from 'lucide-react';
import { renderIndentedText } from '@/lib/utils/statute-text-formatter';

interface StatuteData {
  id: string;
  sectionNum: string;
  heading: string | null;
  text: string;
  textHtml: string | null;
  chapterNum: string;
  chapterTitle: string | null;
  subchapter: string | null;
  subchapterTitle: string | null;
  version: number;
  effectiveDate: string | null;
  sourceUrl: string | null;
  changedByBill: {
    id: string;
    billId: string;
    description: string;
  } | null;
  changeType: string | null;
}

interface AffectingBill {
  id: string;
  action: 'ADD' | 'AMEND' | 'REPEAL';
  billSection: string;
  bill: {
    id: string;
    billId: string;
    billType: string;
    billNumber: number;
    description: string;
    status: string | null;
    authors: string[];
    lastAction: string | null;
    lastActionDate: string | null;
  };
}

interface CodeData {
  abbreviation: string;
  name: string;
}

interface StatuteViewerProps {
  codeAbbr: string | null;
  sectionNum: string | null;
}

function getActionVariant(action: string): 'add' | 'amend' | 'repeal' {
  switch (action) {
    case 'ADD':
      return 'add';
    case 'REPEAL':
      return 'repeal';
    default:
      return 'amend';
  }
}

export function StatuteViewer({ codeAbbr, sectionNum }: StatuteViewerProps) {
  const [code, setCode] = useState<CodeData | null>(null);
  const [statute, setStatute] = useState<StatuteData | null>(null);
  const [affectingBills, setAffectingBills] = useState<AffectingBill[]>([]);
  const [versionCount, setVersionCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codeAbbr || !sectionNum) {
      setCode(null);
      setStatute(null);
      setAffectingBills([]);
      setVersionCount(0);
      setError(null);
      return;
    }

    async function fetchStatute() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/statutes/${encodeURIComponent(codeAbbr!)}/sections/${encodeURIComponent(sectionNum!)}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            setError('Section not found');
          } else {
            setError('Failed to load statute');
          }
          return;
        }

        const data = await response.json();
        setCode(data.code);
        setStatute(data.statute);
        setAffectingBills(data.affectingBills || []);
        setVersionCount(data.versionCount || 1);
      } catch (err) {
        console.error('Error fetching statute:', err);
        setError('Failed to load statute');
      } finally {
        setIsLoading(false);
      }
    }

    fetchStatute();
  }, [codeAbbr, sectionNum]);

  // Empty state
  if (!codeAbbr || !sectionNum) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Scale className="h-16 w-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">Select a statute section</p>
        <p className="text-sm">Click on a section in the tree to view its content</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <FileText className="h-16 w-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">{error}</p>
        <p className="text-sm">Try selecting a different section</p>
      </div>
    );
  }

  if (!statute || !code) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b bg-muted/30">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">
                {code.abbreviation}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Ch. {statute.chapterNum}
                {statute.subchapter && `, Subch. ${statute.subchapter}`}
              </span>
            </div>
            <h1 className="text-xl font-bold">
              § {statute.sectionNum}
            </h1>
            {statute.heading && (
              <p className="text-sm text-muted-foreground mt-1">
                {statute.heading}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {versionCount > 1 && (
              <Link
                href={`/statutes/${code.abbreviation}/${statute.sectionNum}`}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <History className="h-3 w-3" />
                {versionCount} versions
              </Link>
            )}
            {statute.sourceUrl && (
              <a
                href={statute.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
                Source
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <Tabs defaultValue="text" className="flex-1 flex flex-col min-h-0">
        <TabsList className="shrink-0 mx-4 mt-2 w-fit">
          <TabsTrigger value="text">Statute Text</TabsTrigger>
          <TabsTrigger value="bills" className="flex items-center gap-1">
            Affecting Bills
            {affectingBills.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {affectingBills.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              {statute.textHtml ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: statute.textHtml }}
                />
              ) : (
                <div className="text-sm font-mono">
                  {renderIndentedText(statute.text)}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="bills" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {affectingBills.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <p>No pending bills affect this section</p>
                </div>
              ) : (
                affectingBills.map(ref => (
                  <Link
                    key={ref.id}
                    href={`/bills/${ref.bill.billId.replace(' ', '-')}`}
                    className="block"
                  >
                    <Card className="hover:bg-accent/50 transition-colors">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant={ref.bill.billType === 'HB' ? 'hb' : 'sb'}
                                className="text-xs"
                              >
                                {ref.bill.billType}
                              </Badge>
                              <span className="font-medium text-sm">
                                {ref.bill.billId}
                              </span>
                              <Badge
                                variant={getActionVariant(ref.action)}
                                className="text-xs"
                              >
                                {ref.action}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {ref.bill.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <span>{ref.billSection}</span>
                              {ref.bill.status && (
                                <>
                                  <span>·</span>
                                  <span>{ref.bill.status}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
