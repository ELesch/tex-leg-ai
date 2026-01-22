import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AuthorPageProps {
  params: {
    authorName: string;
  };
}

export async function generateMetadata({ params }: AuthorPageProps) {
  const authorName = decodeURIComponent(params.authorName);

  return {
    title: `${authorName} - Bills`,
    description: `View all bills authored by ${authorName} in the Texas Legislature`,
  };
}

export default async function AuthorPage({ params }: AuthorPageProps) {
  const authorName = decodeURIComponent(params.authorName);

  // Find all bills where this author is in the authors array
  const bills = await prisma.bill.findMany({
    where: {
      authors: {
        has: authorName,
      },
    },
    select: {
      id: true,
      billId: true,
      billType: true,
      billNumber: true,
      description: true,
    },
    orderBy: [
      { billType: 'asc' },
      { billNumber: 'asc' },
    ],
  });

  // If no bills found for this author, show 404
  if (bills.length === 0) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <Link
        href="/bills"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Back to Bills
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{authorName}</h1>
        <p className="mt-1 text-muted-foreground">
          {bills.length} bill{bills.length !== 1 ? 's' : ''} authored
        </p>
      </div>

      {/* Bills table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Type</TableHead>
              <TableHead className="w-[100px]">Number</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.map((bill) => (
              <TableRow key={bill.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <Link href={`/bills/${bill.billId.replace(' ', '-')}`} className="block">
                    <Badge variant={bill.billType === 'HB' ? 'hb' : 'sb'}>
                      {bill.billType}
                    </Badge>
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/bills/${bill.billId.replace(' ', '-')}`} className="block font-medium">
                    {bill.billNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/bills/${bill.billId.replace(' ', '-')}`} className="block">
                    <span className="line-clamp-2 text-muted-foreground">{bill.description}</span>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
