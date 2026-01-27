'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, ExternalLink, Loader2, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface AffectingBill {
  id: string;
  billId: string;
  action: 'ADD' | 'AMEND' | 'REPEAL';
  section: string;
  code: string;
  description?: string;
}

interface BillDetail {
  id: string;
  billId: string;
  description: string;
  status: string | null;
  content: string | null;
  authors: string[];
  lastAction: string | null;
}

interface AffectingBillPaneProps {
  codeAbbr: string;
  sectionNum?: string;
  chapterNum?: string;
  className?: string;
}

const actionColors: Record<AffectingBill['action'], string> = {
  ADD: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  AMEND: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  REPEAL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function AffectingBillPane({
  codeAbbr,
  sectionNum,
  chapterNum,
  className,
}: AffectingBillPaneProps) {
  const [affectingBills, setAffectingBills] = useState<AffectingBill[]>([]);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [billDetail, setBillDetail] = useState<BillDetail | null>(null);
  const [isLoadingBills, setIsLoadingBills] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Fetch affecting bills
  const fetchAffectingBills = useCallback(async () => {
    setIsLoadingBills(true);
    setAffectingBills([]);
    setSelectedBillId(null);
    setBillDetail(null);

    try {
      // Build query params
      const params = new URLSearchParams({ code: codeAbbr });
      if (sectionNum) params.set('section', sectionNum);
      if (chapterNum) params.set('chapter', chapterNum);

      const response = await fetch(`/api/bills/code-references?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setAffectingBills(data.references || []);
      }
    } catch (error) {
      console.error('Error fetching affecting bills:', error);
    } finally {
      setIsLoadingBills(false);
    }
  }, [codeAbbr, sectionNum, chapterNum]);

  // Re-fetch when code, section, or chapter changes
  // Note: fetchAffectingBills already depends on these via useCallback,
  // but we include them explicitly to ensure re-fetch on any change
  useEffect(() => {
    if (codeAbbr) {
      fetchAffectingBills();
    }
  }, [fetchAffectingBills, codeAbbr, sectionNum, chapterNum]);

  // Fetch bill detail when selected
  const fetchBillDetail = useCallback(async (billId: string) => {
    setIsLoadingDetail(true);
    setBillDetail(null);

    try {
      const response = await fetch(`/api/bills/${encodeURIComponent(billId)}`);
      if (response.ok) {
        const data = await response.json();
        setBillDetail(data.bill);
      }
    } catch (error) {
      console.error('Error fetching bill detail:', error);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  // Handle bill selection
  const handleBillSelect = useCallback((billId: string) => {
    setSelectedBillId(billId);
    fetchBillDetail(billId);
  }, [fetchBillDetail]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedBillId(null);
    setBillDetail(null);
  }, []);

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className={cn('border rounded-lg', className)}
    >
      <CollapsibleTrigger asChild>
        <button className="flex items-center justify-between w-full p-3 hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">Affecting Bills</span>
            {!isLoadingBills && affectingBills.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {affectingBills.length}
              </Badge>
            )}
          </div>
          <ChevronDown className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            isExpanded && 'rotate-180'
          )} />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t p-3 space-y-3">
          {isLoadingBills ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : affectingBills.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p>No bills affect this statute</p>
            </div>
          ) : (
            <>
              {/* Bill selector */}
              <div className="flex items-center gap-2">
                <Select
                  value={selectedBillId || ''}
                  onValueChange={handleBillSelect}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a bill to view" />
                  </SelectTrigger>
                  <SelectContent>
                    {affectingBills.map(bill => (
                      <SelectItem key={bill.id} value={bill.billId}>
                        <div className="flex items-center gap-2">
                          <Badge className={cn('text-xs', actionColors[bill.action])}>
                            {bill.action}
                          </Badge>
                          <span>{bill.billId}</span>
                          {bill.section && (
                            <span className="text-muted-foreground text-xs">
                              § {bill.section}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedBillId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={clearSelection}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Bill detail */}
              {isLoadingDetail ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : billDetail ? (
                <div className="space-y-3">
                  {/* Bill info */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{billDetail.billId}</h4>
                      <Link href={`/bills/${encodeURIComponent(billDetail.billId)}`}>
                        <Button variant="ghost" size="sm" className="h-7 gap-1">
                          <ExternalLink className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </Link>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {billDetail.description}
                    </p>
                    {billDetail.authors.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        By: {billDetail.authors.join(', ')}
                      </p>
                    )}
                    {billDetail.status && (
                      <Badge variant="outline" className="text-xs">
                        {billDetail.status}
                      </Badge>
                    )}
                  </div>

                  {/* Bill text preview */}
                  {billDetail.content && (
                    <ScrollArea className="h-48 border rounded-md">
                      <pre className="p-3 text-xs whitespace-pre-wrap font-mono">
                        {billDetail.content.slice(0, 5000)}
                        {billDetail.content.length > 5000 && '...'}
                      </pre>
                    </ScrollArea>
                  )}
                </div>
              ) : selectedBillId && !isLoadingDetail ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  <p>Could not load bill details</p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
