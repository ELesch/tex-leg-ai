'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { useTeams } from '@/hooks/use-teams';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  FileText,
  Search,
  Bell,
  Settings,
  BarChart3,
  HelpCircle,
  Shield,
  Users,
  Plus,
  Lock,
} from 'lucide-react';

interface SidebarProps {
  className?: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAuth?: boolean;
}

const navigation: NavItem[] = [
  {
    name: 'Browse Bills',
    href: '/bills',
    icon: FileText,
  },
  {
    name: 'Advanced Search',
    href: '/search',
    icon: Search,
  },
  {
    name: 'Followed Bills',
    href: '/followed',
    icon: Bell,
    requiresAuth: true,
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
  },
];

const secondaryNavigation: NavItem[] = [
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    requiresAuth: true,
  },
  {
    name: 'Help',
    href: '/help',
    icon: HelpCircle,
  },
];

function NavItemComponent({
  item,
  isActive,
  isAuthenticated
}: {
  item: NavItem;
  isActive: boolean;
  isAuthenticated: boolean;
}) {
  const isDisabled = item.requiresAuth && !isAuthenticated;

  if (isDisabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              'text-muted-foreground/50 cursor-not-allowed'
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
            <Lock className="ml-auto h-3 w-3" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>Account required</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <item.icon className="h-4 w-4" />
      {item.name}
    </Link>
  );
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  const isAuthenticated = !!session?.user;
  const { teams, isLoading: teamsLoading } = useTeams();

  return (
    <aside
      className={cn(
        'w-64 flex-col border-r bg-background p-4',
        className
      )}
    >
      <nav className="flex flex-1 flex-col gap-1">
        <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Navigation
        </div>
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <NavItemComponent
              key={item.name}
              item={item}
              isActive={isActive}
              isAuthenticated={isAuthenticated}
            />
          );
        })}

        {/* Teams Section */}
        {session?.user && (
          <>
            <div className="mb-2 mt-6 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Teams
            </div>
            {teamsLoading ? (
              <div className="px-3 py-2">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </div>
            ) : teams.length > 0 ? (
              teams.slice(0, 5).map((team) => {
                const isActive = pathname === `/teams/${team.slug}` || pathname.startsWith(`/teams/${team.slug}/`);
                return (
                  <Link
                    key={team.id}
                    href={`/teams/${team.slug}`}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Users className="h-4 w-4" />
                    <span className="truncate">{team.name}</span>
                  </Link>
                );
              })
            ) : null}
            <Link
              href="/teams/new"
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                pathname === '/teams/new'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Plus className="h-4 w-4" />
              Create Team
            </Link>
            {teams.length > 5 && (
              <Link
                href="/teams"
                className="flex items-center gap-3 rounded-md px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                View all {teams.length} teams →
              </Link>
            )}
          </>
        )}

        <div className="mb-2 mt-6 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          More
        </div>
        {secondaryNavigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <NavItemComponent
              key={item.name}
              item={item}
              isActive={isActive}
              isAuthenticated={isAuthenticated}
            />
          );
        })}

        {/* Admin Link */}
        {isAdmin && (
          <>
            <div className="mb-2 mt-6 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Admin
            </div>
            <Link
              href="/admin"
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith('/admin')
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Shield className="h-4 w-4" />
              Admin Panel
            </Link>
          </>
        )}
      </nav>

      {/* Session info */}
      <div className="mt-auto border-t pt-4">
        <div className="rounded-md bg-muted p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Current Session
          </p>
          <p className="mt-1 text-sm font-semibold">89th Regular Session</p>
          <p className="text-xs text-muted-foreground">2025</p>
        </div>
      </div>
    </aside>
  );
}
