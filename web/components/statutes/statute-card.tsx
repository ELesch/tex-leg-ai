'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight, Scale } from 'lucide-react';

interface StatuteCardProps {
  code: string;
  codeAbbreviation: string;
  sectionNum: string;
  heading: string | null;
  text?: string;
  billCount?: number;
  action?: 'ADD' | 'AMEND' | 'REPEAL';
  billSection?: string;
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

export function StatuteCard({
  code,
  codeAbbreviation,
  sectionNum,
  heading,
  text,
  billCount,
  action,
  billSection,
}: StatuteCardProps) {
  return (
    <Link
      href={`/statutes/${encodeURIComponent(codeAbbreviation)}/${encodeURIComponent(sectionNum)}`}
    >
      <Card className="transition-colors hover:bg-accent">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Scale className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">
                  {codeAbbreviation} {sectionNum}
                </span>
                {action && (
                  <Badge variant={getActionVariant(action)}>
                    {action}
                  </Badge>
                )}
              </div>
              {heading && (
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  {heading}
                </p>
              )}
              {text && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                  {text}
                </p>
              )}
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{code}</span>
                {billCount !== undefined && billCount > 0 && (
                  <>
                    <span>·</span>
                    <span>
                      {billCount} {billCount === 1 ? 'bill' : 'bills'} affecting
                    </span>
                  </>
                )}
                {billSection && (
                  <>
                    <span>·</span>
                    <span>{billSection}</span>
                  </>
                )}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
