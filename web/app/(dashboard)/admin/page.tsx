import { prisma } from '@/lib/db/prisma';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, RefreshCw, Settings } from 'lucide-react';
import Link from 'next/link';

async function getStats() {
  const [userCount, billCount, lastSync] = await Promise.all([
    prisma.user.count(),
    prisma.bill.count(),
    prisma.bill.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
  ]);

  return {
    userCount,
    billCount,
    lastSyncAt: lastSync?.updatedAt,
  };
}

export default async function AdminDashboardPage() {
  const stats = await getStats();

  const statCards = [
    {
      title: 'Total Users',
      value: stats.userCount.toString(),
      description: 'Registered users',
      icon: Users,
      href: '/admin/users',
    },
    {
      title: 'Total Bills',
      value: stats.billCount.toString(),
      description: 'Bills in database',
      icon: FileText,
      href: '/admin/sync',
    },
    {
      title: 'Last Sync',
      value: stats.lastSyncAt
        ? new Date(stats.lastSyncAt).toLocaleDateString()
        : 'Never',
      description: stats.lastSyncAt
        ? new Date(stats.lastSyncAt).toLocaleTimeString()
        : 'No bills synced yet',
      icon: RefreshCw,
      href: '/admin/sync',
    },
  ];

  const quickLinks = [
    {
      title: 'System Settings',
      description: 'Configure session, sync, AI, and feature settings',
      href: '/admin/settings',
      icon: Settings,
    },
    {
      title: 'Manage Users',
      description: 'View and manage user accounts and roles',
      href: '/admin/users',
      icon: Users,
    },
    {
      title: 'Bill Sync',
      description: 'Trigger manual sync and view sync status',
      href: '/admin/sync',
      icon: RefreshCw,
    },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Fixed header */}
      <div className="flex-shrink-0 p-6 pb-0">
        <h2 className="text-2xl font-bold tracking-tight">Admin Dashboard</h2>
        <p className="text-muted-foreground">
          System overview and quick actions
        </p>
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Links */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {quickLinks.map((link) => (
            <Link key={link.title} href={link.href}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <link.icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{link.title}</CardTitle>
                  </div>
                  <CardDescription>{link.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
