import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { auth } from '@/lib/auth';
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
import { AuthorPageClient } from './author-page-client';
import { Chamber } from '@prisma/client';

interface AuthorPageProps {
  params: Promise<{
    authorName: string;
  }>;
}

export async function generateMetadata({ params }: AuthorPageProps) {
  const { authorName } = await params;
  const decodedName = decodeURIComponent(authorName);

  return {
    title: `${decodedName} - Bills`,
    description: `View all bills authored by ${decodedName} in the Texas Legislature`,
  };
}

// Helper to infer chamber from author name prefix
function inferChamber(name: string): Chamber | null {
  if (name.startsWith('Rep.') || name.startsWith('Representative')) {
    return 'HOUSE';
  }
  if (name.startsWith('Sen.') || name.startsWith('Senator')) {
    return 'SENATE';
  }
  return null;
}

export default async function AuthorPage({ params }: AuthorPageProps) {
  const { authorName } = await params;
  const decodedName = decodeURIComponent(authorName);
  const session = await auth();

  // Find all bills where this author is in the authors array
  const bills = await prisma.bill.findMany({
    where: {
      authors: {
        has: decodedName,
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

  // Get or create Author record for the contacts panel
  let author = await prisma.author.findUnique({
    where: { name: decodedName },
  });

  if (!author) {
    // Create Author record on first visit
    author = await prisma.author.create({
      data: {
        name: decodedName,
        chamber: inferChamber(decodedName),
      },
    });
  }

  const isAuthenticated = !!session?.user?.id;

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

      {/* 2-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main content - Bills */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold">{decodedName}</h1>
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

        {/* Sidebar - Contacts Panel (only for authenticated users) */}
        {isAuthenticated && (
          <div className="w-full lg:w-80 shrink-0">
            <AuthorPageClient authorId={author.id} authorName={decodedName} />
          </div>
        )}
      </div>
    </div>
  );
}
