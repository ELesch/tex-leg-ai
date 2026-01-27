'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Scale,
  ArrowLeft,
  ExternalLink,
  FileText,
  History,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

interface StatuteData {
  code: {
    abbreviation: string;
    name: string;
  };
  statute: {
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
      status: string | null;
    } | null;
    changeType: 'ADD' | 'AMEND' | 'REPEAL' | null;
  };
  affectingBills: Array<{
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
  }>;
  versionCount: number;
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

export default function StatuteDetailPage() {
  const params = useParams();
  const code = (params.code as string).toUpperCase();
  const section = decodeURIComponent(params.section as string);

  const [data, setData] = useState<StatuteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStatute() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/statutes/${encodeURIComponent(code)}/sections/${encodeURIComponent(section)}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            setError('Statute section not found');
          } else {
            setError('Failed to load statute');
          }
          return;
        }

        const data = await response.json();
        setData(data);
      } catch (err) {
        console.error('Error fetching statute:', err);
        setError('Failed to load statute');
      } finally {
        setIsLoading(false);
      }
    }

    fetchStatute();
  }, [code, section]);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-shrink-0 border-b p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-semibold">{error || 'Statute not found'}</h2>
        <p className="mt-2 text-muted-foreground">
          The requested statute section could not be found.
        </p>
        <Button asChild className="mt-4">
          <Link href="/statutes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Statutes
          </Link>
        </Button>
      </div>
    );
  }

  const { statute, affectingBills, versionCount } = data;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/statutes" className="hover:text-foreground">
            Statutes
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link
            href={`/statutes?code=${encodeURIComponent(data.code.name)}`}
            className="hover:text-foreground"
          >
            {data.code.name}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span>{statute.sectionNum}</span>
        </div>

        <div className="mt-4 flex items-start justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold">
              <Scale className="h-6 w-6" />
              {data.code.abbreviation} {statute.sectionNum}
              {statute.heading && (
                <span className="text-lg font-normal text-muted-foreground">
                  {statute.heading}
                </span>
              )}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {data.code.name} - Chapter {statute.chapterNum}
              {statute.subchapter && `, Subchapter ${statute.subchapter}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {statute.sourceUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={statute.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Official Source
                </a>
              </Button>
            )}
            <Badge variant="secondary">Version {statute.version}</Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-6">
        <Tabs defaultValue="text" className="flex h-full flex-col">
          <TabsList className="mb-4">
            <TabsTrigger value="text">
              <FileText className="mr-2 h-4 w-4" />
              Statute Text
            </TabsTrigger>
            <TabsTrigger value="bills">
              <Scale className="mr-2 h-4 w-4" />
              Affecting Bills ({affectingBills.length})
            </TabsTrigger>
            {versionCount > 1 && (
              <TabsTrigger value="history">
                <History className="mr-2 h-4 w-4" />
                History ({versionCount})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="text" className="flex-1 overflow-hidden">
            <Card className="h-full">
              <CardContent className="h-full p-0">
                <ScrollArea className="h-full p-6">
                  {statute.textHtml ? (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: statute.textHtml }}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap font-mono text-sm">
                      {statute.text}
                    </pre>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bills" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {affectingBills.length === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  No bills currently affect this section
                </div>
              ) : (
                <div className="space-y-3">
                  {affectingBills.map((ref) => (
                    <Link
                      key={ref.id}
                      href={`/bills/${ref.bill.billId.replace(' ', '-')}`}
                      className="block"
                    >
                      <Card className="transition-colors hover:bg-accent">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={ref.bill.billType === 'HB' ? 'hb' : 'sb'}
                                >
                                  {ref.bill.billType}
                                </Badge>
                                <span className="font-semibold">{ref.bill.billId}</span>
                                <Badge variant={getActionVariant(ref.action)}>
                                  {ref.action}
                                </Badge>
                              </div>
                              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                                {ref.bill.description}
                              </p>
                              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                                <span>{ref.billSection}</span>
                                {ref.bill.authors.length > 0 && (
                                  <span>by {ref.bill.authors[0]}</span>
                                )}
                                {ref.bill.status && <span>{ref.bill.status}</span>}
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {versionCount > 1 && (
            <TabsContent value="history" className="flex-1 overflow-hidden">
              <StatuteHistory code={code} section={section} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

interface VersionData {
  id: string;
  version: number;
  isCurrent: boolean;
  effectiveDate: string | null;
  supersededAt: string | null;
  changeType: 'ADD' | 'AMEND' | 'REPEAL' | null;
  text: string;
  changedByBill: {
    id: string;
    billId: string;
    description: string;
    status: string | null;
  } | null;
  createdAt: string;
}

function StatuteHistory({ code, section }: { code: string; section: string }) {
  const [versions, setVersions] = useState<VersionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const response = await fetch(
          `/api/statutes/${encodeURIComponent(code)}/sections/${encodeURIComponent(section)}/history`
        );
        if (response.ok) {
          const data = await response.json();
          setVersions(data.versions);
        }
      } catch (err) {
        console.error('Error fetching history:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchHistory();
  }, [code, section]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3">
        {versions.map((version, index) => (
          <Card key={version.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant={version.isCurrent ? 'default' : 'secondary'}>
                    Version {version.version}
                  </Badge>
                  {version.isCurrent && (
                    <Badge variant="outline">Current</Badge>
                  )}
                  {version.changeType && (
                    <Badge variant={getActionVariant(version.changeType)}>
                      {version.changeType}
                    </Badge>
                  )}
                </div>
                {version.effectiveDate && (
                  <span className="text-muted-foreground">
                    Effective: {new Date(version.effectiveDate).toLocaleDateString()}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {version.changedByBill && (
                <Link
                  href={`/bills/${version.changedByBill.billId.replace(' ', '-')}`}
                  className="mb-2 block text-sm text-primary hover:underline"
                >
                  Changed by {version.changedByBill.billId}: {version.changedByBill.description.substring(0, 100)}...
                </Link>
              )}
              {index === 0 ? null : (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    View text (collapsed)
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 font-mono text-xs">
                    {version.text.substring(0, 500)}
                    {version.text.length > 500 && '...'}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
