import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// DELETE /api/admin/sync/clear - Clear all legislative data
export async function DELETE(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Check for confirmation header
  const confirmHeader = request.headers.get('x-confirm-delete');
  if (confirmHeader !== 'CONFIRM_DELETE_ALL_DATA') {
    return NextResponse.json(
      { error: 'Missing confirmation header' },
      { status: 400 }
    );
  }

  try {
    // Delete in order of dependencies
    const [
      terminologyReplacements,
      billCodeReferences,
      billArticles,
      bills,
    ] = await prisma.$transaction([
      prisma.terminologyReplacement.deleteMany({}),
      prisma.billCodeReference.deleteMany({}),
      prisma.billArticle.deleteMany({}),
      prisma.bill.deleteMany({}),
    ]);

    return NextResponse.json({
      success: true,
      deleted: {
        bills: bills.count,
        billArticles: billArticles.count,
        billCodeReferences: billCodeReferences.count,
        terminologyReplacements: terminologyReplacements.count,
      },
    });
  } catch (error) {
    console.error('Error clearing data:', error);
    return NextResponse.json(
      { error: 'Failed to clear data' },
      { status: 500 }
    );
  }
}
