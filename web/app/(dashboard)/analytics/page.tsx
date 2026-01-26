'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart3,
  FileText,
  Users,
  Bell,
  TrendingUp,
  Loader2,
  Activity,
  UserCircle,
} from 'lucide-react';

interface AnalyticsData {
  overview: {
    totalBills: number;
    recentlyUpdated: number;
    totalUsers: number;
    totalTeams: number;
    totalFollowedBills: number;
  };
  typeDistribution: Array<{
    type: string;
    count: number;
  }>;
  topAuthors: Array<{
    name: string;
    count: number;
  }>;
}

const BILL_TYPE_LABELS: Record<string, string> = {
  HB: 'House Bills',
  SB: 'Senate Bills',
  HJR: 'House Joint Resolutions',
  SJR: 'Senate Joint Resolutions',
  HCR: 'House Concurrent Resolutions',
  SCR: 'Senate Concurrent Resolutions',
};


export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch('/api/analytics');
        if (res.ok) {
          const analyticsData = await res.json();
          setData(analyticsData);
        } else {
          setError('Failed to load analytics');
        }
      } catch (err) {
        console.error('Analytics error:', err);
        setError('Failed to load analytics');
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalytics();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">{error || 'Something went wrong'}</p>
      </div>
    );
  }

  const maxTypeCount = Math.max(...data.typeDistribution.map((t) => t.count));
  const maxAuthorCount = data.topAuthors.length > 0 ? data.topAuthors[0].count : 1;

  return (
    <div className="flex h-full flex-col">
      {/* Fixed header */}
      <div className="flex-shrink-0 p-6 pb-0">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Statistics and insights about Texas legislation
        </p>
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.totalBills.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              89th Legislature Regular Session
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recently Updated</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.recentlyUpdated.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Bills with activity in last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.totalUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Registered users on the platform
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Followed Bills</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.totalFollowedBills.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Bills followed by users
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bill Type Distribution */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              <CardTitle>Bills by Type</CardTitle>
            </div>
            <CardDescription>Distribution of legislation by category</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.typeDistribution
              .sort((a, b) => b.count - a.count)
              .map((item) => (
                <div key={item.type} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={item.type === 'HB' ? 'hb' : item.type === 'SB' ? 'sb' : 'outline'}>
                        {item.type}
                      </Badge>
                      <span className="text-muted-foreground">
                        {BILL_TYPE_LABELS[item.type] || item.type}
                      </span>
                    </div>
                    <span className="font-medium">{item.count.toLocaleString()}</span>
                  </div>
                  <Progress
                    value={(item.count / maxTypeCount) * 100}
                    className="h-2"
                  />
                </div>
              ))}
          </CardContent>
        </Card>

        {/* Top Authors */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              <CardTitle>Top Bill Authors</CardTitle>
            </div>
            <CardDescription>Legislators with the most bills filed</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead className="text-right w-[100px]">Bills</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topAuthors.map((author, index) => (
                  <TableRow key={author.name}>
                    <TableCell className="font-medium text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/authors/${encodeURIComponent(author.name)}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <UserCircle className="h-4 w-4 text-muted-foreground" />
                        {author.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16">
                          <Progress
                            value={(author.count / maxAuthorCount) * 100}
                            className="h-2"
                          />
                        </div>
                        <span className="font-medium w-8 text-right">{author.count}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Platform Activity</CardTitle>
            <CardDescription>Engagement statistics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Active Teams</span>
              <span className="font-medium">{data.overview.totalTeams}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Avg. Follows per User</span>
              <span className="font-medium">
                {data.overview.totalUsers > 0
                  ? (data.overview.totalFollowedBills / data.overview.totalUsers).toFixed(1)
                  : '0'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Bills per Author (avg)</span>
              <span className="font-medium">
                {data.topAuthors.length > 0
                  ? Math.round(
                      data.topAuthors.reduce((sum, a) => sum + a.count, 0) / data.topAuthors.length
                    )
                  : '0'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Session Information</CardTitle>
            <CardDescription>Current legislative session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Session</span>
              <span className="font-medium">89th Regular</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Year</span>
              <span className="font-medium">2025</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Chamber</span>
              <span className="font-medium">Both Houses</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Links</CardTitle>
            <CardDescription>Explore the data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/bills"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <FileText className="h-4 w-4" />
              Browse All Bills
            </Link>
            <Link
              href="/search"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <BarChart3 className="h-4 w-4" />
              Advanced Search
            </Link>
            <Link
              href="/followed"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <Bell className="h-4 w-4" />
              Your Followed Bills
            </Link>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
