'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface AffectingBill {
  id: string;
  billId: string;
  description: string;
  status: string | null;
  authors: string[];
  action: string;
}

interface StatuteBillSelectorProps {
  codeAbbr: string;
  chapterNum: string;
  selectedBillId: string | null;
  onBillSelect: (billId: string | null, bill: AffectingBill | null) => void;
  className?: string;
}

const actionColors: Record<string, string> = {
  ADD: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  AMEND: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  REPEAL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function StatuteBillSelector({
  codeAbbr,
  chapterNum,
  selectedBillId,
  onBillSelect,
  className,
}: StatuteBillSelectorProps) {
  const [bills, setBills] = useState<AffectingBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBills = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        codeAbbr,
        chapterNum,
      });
      const response = await fetch(`/api/statute-chat/affecting-bills?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setBills(data.bills || []);
      }
    } catch (error) {
      console.error('Error fetching affecting bills:', error);
    } finally {
      setIsLoading(false);
    }
  }, [codeAbbr, chapterNum]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const handleValueChange = useCallback((value: string) => {
    if (value === '__none__') {
      onBillSelect(null, null);
    } else {
      const bill = bills.find(b => b.id === value);
      onBillSelect(value, bill || null);
    }
  }, [bills, onBillSelect]);

  if (isLoading) {
    return <Skeleton className={cn('h-9 w-full', className)} />;
  }

  if (bills.length === 0) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        No bills affect this chapter
      </div>
    );
  }

  return (
    <Select
      value={selectedBillId || '__none__'}
      onValueChange={handleValueChange}
    >
      <SelectTrigger className={cn('w-full', className)}>
        <SelectValue placeholder="Include a bill (optional)" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">
          <span className="text-muted-foreground">No bill selected</span>
        </SelectItem>
        {bills.map(bill => (
          <SelectItem key={bill.id} value={bill.id}>
            <div className="flex items-center gap-2">
              <Badge className={cn('text-xs', actionColors[bill.action] || 'bg-gray-100 text-gray-800')}>
                {bill.action}
              </Badge>
              <span>{bill.billId}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
