'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useTeams } from '@/hooks/use-teams';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Sun,
  Moon,
  Monitor,
  LogOut,
} from 'lucide-react';
import { SyncStatusIndicator } from '@/components/admin/sync-status-indicator';

interface SidebarProps {
  className?: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAuth?: boolean;
  hideWhenNotAuth?: boolean;
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
    hideWhenNotAuth: true,
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
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  const isAuthenticated = !!session?.user;
  const { teams, isLoading: teamsLoading } = useTeams();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter secondary nav items based on auth state
  const filteredSecondaryNav = secondaryNavigation.filter(
    (item) => !(item.hideWhenNotAuth && !isAuthenticated)
  );

  return (
    <aside
      className={cn(
        'w-64 flex-col border-r bg-background h-screen',
        className
      )}
    >
      {/* Logo at top */}
      <div className="flex-shrink-0 border-b p-4">
        <Link href="/bills" className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">TexLegAI</span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
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
        {filteredSecondaryNav.map((item) => {
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

      {/* Bottom section: Theme, Auth, User */}
      <div className="flex-shrink-0 border-t p-4">
        {/* Sync Status for Admins */}
        {isAdmin && (
          <div className="mb-4">
            <SyncStatusIndicator isAdmin={true} />
          </div>
        )}

        {/* Theme Switcher */}
        <div className="mb-4">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Theme
          </p>
          <div className="flex gap-1">
            <Button
              variant={mounted && theme === 'light' ? 'secondary' : 'ghost'}
              size="sm"
              className="flex-1"
              onClick={() => setTheme('light')}
            >
              <Sun className="mr-1 h-4 w-4" />
              Light
            </Button>
            <Button
              variant={mounted && theme === 'dark' ? 'secondary' : 'ghost'}
              size="sm"
              className="flex-1"
              onClick={() => setTheme('dark')}
            >
              <Moon className="mr-1 h-4 w-4" />
              Dark
            </Button>
            <Button
              variant={mounted && theme === 'system' ? 'secondary' : 'ghost'}
              size="sm"
              className="flex-1"
              onClick={() => setTheme('system')}
            >
              <Monitor className="mr-1 h-4 w-4" />
              Auto
            </Button>
          </div>
        </div>

        {/* Auth Section */}
        {status === 'loading' ? (
          <div className="flex items-center gap-3 p-2">
            <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
            <div className="flex-1">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ) : isAuthenticated ? (
          <div className="flex items-center gap-3 rounded-md p-2 hover:bg-muted">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 text-left">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    {session?.user?.name?.[0]?.toUpperCase() ||
                      session?.user?.email?.[0]?.toUpperCase() ||
                      'U'}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium">
                      {session?.user?.name || 'User'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {session?.user?.email}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" side="top">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {session?.user?.name || 'User'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session?.user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={() => signOut({ callbackUrl: '/' })}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Link href="/login">
              <Button variant="outline" className="w-full">
                Sign in
              </Button>
            </Link>
            <Link href="/register">
              <Button className="w-full">Sign up</Button>
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
