import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { truncate, formatDate } from '@/lib/utils';
import type { BillSummary } from '@/types';

interface BillCardProps {
  bill: BillSummary;
}

export function BillCard({ bill }: BillCardProps) {
  return (
    <Card className="h-full transition-colors hover:bg-muted/50">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant={bill.billType === 'HB' ? 'hb' : 'sb'}>
              {bill.billType}
            </Badge>
            <span className="font-semibold">{bill.billId}</span>
          </div>
          {bill.status && (
            <Badge variant="outline" className="text-xs">
              {bill.status}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {truncate(bill.description, 150)}
        </p>
        {bill.lastAction && (
          <div className="mt-3 text-xs text-muted-foreground">
            <span className="font-medium">Last action:</span>{' '}
            {truncate(bill.lastAction, 50)}
            {bill.lastActionDate && (
              <span className="ml-1">
                ({formatDate(bill.lastActionDate)})
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
