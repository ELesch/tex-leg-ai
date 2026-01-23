import { requireAdmin } from '@/lib/admin/require-admin';
import Link from 'next/link';
import { Settings, Users, RefreshCw, LayoutDashboard, ScrollText } from 'lucide-react';

const adminNavigation = [
  {
    name: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    name: 'Settings',
    href: '/admin/settings',
    icon: Settings,
  },
  {
    name: 'Users',
    href: '/admin/users',
    icon: Users,
  },
  {
    name: 'Bill Sync',
    href: '/admin/sync',
    icon: RefreshCw,
  },
  {
    name: 'Logs',
    href: '/admin/logs',
    icon: ScrollText,
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side admin check - redirects non-admins
  await requireAdmin();

  return (
    <div className="flex flex-col">
      <div className="border-b bg-background">
        <div className="flex h-12 items-center gap-4 px-4">
          <h1 className="text-lg font-semibold">Admin Panel</h1>
          <nav className="flex items-center gap-1">
            {adminNavigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
