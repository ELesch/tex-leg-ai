import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get total counts by bill type
    const billsByType = await prisma.bill.groupBy({
      by: ['billType'],
      _count: {
        id: true,
      },
    });

    // Get total bill count
    const totalBills = await prisma.bill.count();

    // Get bills with recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentlyUpdated = await prisma.bill.count({
      where: {
        lastActionDate: {
          gte: thirtyDaysAgo,
        },
      },
    });

    // Get top authors by bill count
    const allBills = await prisma.bill.findMany({
      select: {
        authors: true,
      },
    });

    const authorCounts: Record<string, number> = {};
    allBills.forEach((bill) => {
      bill.authors.forEach((author) => {
        authorCounts[author] = (authorCounts[author] || 0) + 1;
      });
    });

    const topAuthors = Object.entries(authorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Get user stats
    const totalUsers = await prisma.user.count();
    const totalTeams = await prisma.team.count();
    const totalFollowedBills = await prisma.followedBill.count();

    // Get bill type distribution for chart
    const typeDistribution = billsByType.map((item) => ({
      type: item.billType,
      count: item._count.id,
    }));

    return NextResponse.json({
      overview: {
        totalBills,
        recentlyUpdated,
        totalUsers,
        totalTeams,
        totalFollowedBills,
      },
      typeDistribution,
      topAuthors,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
