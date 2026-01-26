'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronDown,
  ChevronUp,
  Scale,
  ExternalLink,
} from 'lucide-react';

interface CodeReference {
  id: string;
  code: string;
  title: string | null;
  chapter: string;
  subchapter: string | null;
  section: string;
  subsections: string[];
  action: 'ADD' | 'AMEND' | 'REPEAL';
  billSection: string;
}

interface CodeReferencesCardProps {
  billId: string;
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

function getActionLabel(action: string): string {
  switch (action) {
    case 'ADD':
      return 'Add';
    case 'REPEAL':
      return 'Repeal';
    default:
      return 'Amend';
  }
}

export function CodeReferencesCard({ billId }: CodeReferencesCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<{
    references: CodeReference[];
    groupedByCode: Record<string, CodeReference[]>;
    totalCount: number;
  } | null>(null);

  useEffect(() => {
    async function fetchReferences() {
      try {
        const response = await fetch(`/api/bills/${encodeURIComponent(billId)}/code-references`);
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error('Error fetching code references:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchReferences();
  }, [billId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Affected Statutes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Affected Statutes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No statute references found in this bill.
          </p>
        </CardContent>
      </Card>
    );
  }

  const codeNames = Object.keys(data.groupedByCode);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            <span>Affected Statutes</span>
            <Badge variant="secondary" className="ml-2">
              {data.totalCount} {data.totalCount === 1 ? 'reference' : 'references'}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" className="ml-2 shrink-0">
            {isExpanded ? (
              <>
                <ChevronUp className="mr-1 h-4 w-4" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown className="mr-1 h-4 w-4" />
                Expand
              </>
            )}
          </Button>
        </CardTitle>
        {!isExpanded && (
          <p className="line-clamp-1 text-sm text-muted-foreground">
            {codeNames.join(', ')}
          </p>
        )}
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-4">
          {codeNames.map((codeName) => (
            <div key={codeName} className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{codeName}</h4>
                <Link
                  href={`/statutes?code=${encodeURIComponent(codeName)}`}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  Browse
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-1">
                {data.groupedByCode[codeName].map((ref) => (
                  <div
                    key={ref.id}
                    className="flex items-start justify-between gap-2 rounded-md border p-2 text-sm"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={getActionVariant(ref.action)} className="text-xs">
                          {getActionLabel(ref.action)}
                        </Badge>
                        <span className="font-medium">{ref.section}</span>
                        {ref.subsections && ref.subsections.length > 0 && (
                          <span className="text-muted-foreground">
                            {ref.subsections.join(', ')}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {ref.chapter && <span>{ref.chapter}</span>}
                        {ref.subchapter && <span> &bull; {ref.subchapter}</span>}
                        <span className="ml-2">({ref.billSection})</span>
                      </div>
                    </div>
                    <Link
                      href={`/statutes?code=${encodeURIComponent(codeName)}&section=${encodeURIComponent(ref.section)}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Related bills
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
