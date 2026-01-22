import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { BillDetailWorkspace } from '@/components/bills/bill-detail-workspace';

interface BillDetailPageProps {
  params: {
    billId: string;
  };
}

export async function generateMetadata({ params }: BillDetailPageProps) {
  // Convert URL-safe bill ID to actual bill ID (HB-123 -> HB 123)
  const billId = params.billId.replace('-', ' ').toUpperCase();

  const bill = await prisma.bill.findUnique({
    where: { billId },
    select: { billId: true, description: true },
  });

  if (!bill) {
    return { title: 'Bill Not Found' };
  }

  return {
    title: bill.billId,
    description: bill.description.slice(0, 160),
  };
}

export default async function BillDetailPage({ params }: BillDetailPageProps) {
  // Convert URL-safe bill ID to actual bill ID (HB-123 -> HB 123)
  const billId = params.billId.replace('-', ' ').toUpperCase();

  const bill = await prisma.bill.findUnique({
    where: { billId },
    include: {
      session: {
        select: {
          code: true,
          name: true,
        },
      },
    },
  });

  if (!bill) {
    notFound();
  }

  return <BillDetailWorkspace bill={bill} />;
}
