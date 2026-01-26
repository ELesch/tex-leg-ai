'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, ArrowRight } from 'lucide-react';

interface RelatedBill {
  id: string;
  billId: string;
  billType: string;
  billNumber: number;
  description: string;
  status: string | null;
}

interface RelatedBillsProps {
  billId: string;
  maxBills?: number;
}

export function RelatedBills({ billId, maxBills = 5 }: RelatedBillsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [relatedBills, setRelatedBills] = useState<RelatedBill[]>([]);
  const [sharedSections, setSharedSections] = useState<string[]>([]);

  useEffect(() => {
    async function fetchRelatedBills() {
      try {
        // First, get code references for this bill
        const refsResponse = await fetch(`/api/bills/${encodeURIComponent(billId)}/code-references`);
        if (!refsResponse.ok) {
          setIsLoading(false);
          return;
        }

        const refsData = await refsResponse.json();
        if (!refsData.references || refsData.references.length === 0) {
          setIsLoading(false);
          return;
        }

        // Find other bills that affect the same sections
        const relatedBillsMap = new Map<string, { bill: RelatedBill; sections: string[] }>();
        const sectionsSet = new Set<string>();

        // Check first 3 sections to avoid too many requests
        const sectionsToCheck = refsData.references.slice(0, 3);

        for (const ref of sectionsToCheck) {
          const billsResponse = await fetch(
            `/api/codes/${encodeURIComponent(ref.code)}/sections/${encodeURIComponent(ref.section)}/bills`
          );

          if (billsResponse.ok) {
            const billsData = await billsResponse.json();
            const sectionKey = `${ref.code} ${ref.section}`;
            sectionsSet.add(sectionKey);

            for (const refItem of billsData.references) {
              // Skip the current bill
              if (refItem.bill.billId === billId) continue;

              if (relatedBillsMap.has(refItem.bill.id)) {
                relatedBillsMap.get(refItem.bill.id)!.sections.push(sectionKey);
              } else {
                relatedBillsMap.set(refItem.bill.id, {
                  bill: refItem.bill,
                  sections: [sectionKey],
                });
              }
            }
          }
        }

        // Sort by number of shared sections, then by bill number
        const sorted = Array.from(relatedBillsMap.values())
          .sort((a, b) => {
            if (b.sections.length !== a.sections.length) {
              return b.sections.length - a.sections.length;
            }
            return a.bill.billNumber - b.bill.billNumber;
          })
          .slice(0, maxBills);

        setRelatedBills(sorted.map(item => item.bill));
        setSharedSections(Array.from(sectionsSet));
      } catch (error) {
        console.error('Error fetching related bills:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRelatedBills();
  }, [billId, maxBills]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Related Bills
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (relatedBills.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Related Bills
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No related bills found affecting the same statutes.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Related Bills
          <Badge variant="secondary" className="ml-auto">
            {relatedBills.length}
          </Badge>
        </CardTitle>
        {sharedSections.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Bills affecting the same statute sections
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {relatedBills.map((bill) => (
          <Link
            key={bill.id}
            href={`/bills/${bill.billId.replace(' ', '-')}`}
            className="flex items-center justify-between gap-2 rounded-md border p-2 hover:bg-accent transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant={bill.billType === 'HB' ? 'hb' : 'sb'} className="text-xs">
                  {bill.billType}
                </Badge>
                <span className="font-medium">{bill.billId}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                {bill.description}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
