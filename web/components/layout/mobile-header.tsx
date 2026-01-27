'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';
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
  Menu,
  X,
  Search,
  Bell,
  BarChart3,
  HelpCircle,
  Lock,
  Settings,
  Shield,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Users,
  Scale,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { useEffect } from 'react';

interface MobileHeaderProps {
  className?: string;
}

interface MobileNavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAuth?: boolean;
  hideWhenNotAuth?: boolean;
}

const mobileNavItems: MobileNavItem[] = [
  { name: 'Browse Bills', href: '/bills', icon: FileText },
  { name: 'Advanced Search', href: '/search', icon: Search },
  { name: 'Followed Bills', href: '/followed', icon: Bell, requiresAuth: true },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Statutes', href: '/statutes', icon: Scale },
  { name: 'Statute Browser', href: '/statute-browser', icon: BookOpen },
  { name: 'Teams', href: '/teams', icon: Users, requiresAuth: true, hideWhenNotAuth: true },
  { name: 'Help', href: '/help', icon: HelpCircle },
];

export function MobileHeader({ className }: MobileHeaderProps) {
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAuthenticated = !!session?.user;
  const isAdmin = session?.user?.role === 'ADMIN';
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className={cn('sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60', className)}>
      <div className="flex h-14 items-center justify-between px-4">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>

        {/* Logo */}
        <Link href="/bills" className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold">TexLegAI</span>
        </Link>

        {/* User section */}
        <div className="flex items-center">
          {status === 'loading' ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          ) : session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    {session.user?.name?.[0]?.toUpperCase() ||
                      session.user?.email?.[0]?.toUpperCase() ||
                      'U'}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {session.user?.name || 'User'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session.user?.email}
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
          ) : (
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      <div
        className={cn(
          'border-t',
          mobileMenuOpen ? 'block' : 'hidden'
        )}
      >
        <nav className="flex flex-col gap-1 p-4">
          {mobileNavItems
            .filter((item) => !(item.hideWhenNotAuth && !isAuthenticated))
            .map((item) => {
              const isDisabled = item.requiresAuth && !isAuthenticated;

              if (isDisabled) {
                return (
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                          'text-muted-foreground/50 cursor-not-allowed'
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.name}
                        <Lock className="ml-auto h-3 w-3" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Account required</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}

          {/* Admin link */}
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Shield className="h-4 w-4" />
              Admin Panel
            </Link>
          )}

          {/* Theme options */}
          <div className="mt-4 border-t pt-4">
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Theme
            </p>
            <div className="flex gap-2 px-3">
              <Button
                variant={mounted && theme === 'light' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setTheme('light')}
              >
                <Sun className="h-4 w-4" />
              </Button>
              <Button
                variant={mounted && theme === 'dark' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setTheme('dark')}
              >
                <Moon className="h-4 w-4" />
              </Button>
              <Button
                variant={mounted && theme === 'system' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setTheme('system')}
              >
                <Monitor className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Sign up button for non-authenticated */}
          {!isAuthenticated && (
            <div className="mt-4 border-t pt-4">
              <Link href="/register">
                <Button className="w-full">Sign up</Button>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
