'use client';

import { Badge } from '@/components/ui/badge';
import { StaffRole } from '@prisma/client';
import { cn } from '@/lib/utils';

// Staff position display names and priority order
export const staffRoleConfig: Record<
  StaffRole,
  { label: string; priority: number; color: string }
> = {
  CHIEF_OF_STAFF: {
    label: 'Chief of Staff',
    priority: 1,
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
  },
  LEGISLATIVE_DIRECTOR: {
    label: 'Legislative Director',
    priority: 2,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  },
  COMMUNICATIONS_DIRECTOR: {
    label: 'Communications Director',
    priority: 3,
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  },
  DISTRICT_DIRECTOR: {
    label: 'District Director',
    priority: 4,
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
  },
  POLICY_ADVISOR: {
    label: 'Policy Advisor',
    priority: 5,
    color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100',
  },
  COMMITTEE_CLERK: {
    label: 'Committee Clerk',
    priority: 6,
    color: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100',
  },
  SCHEDULER: {
    label: 'Scheduler',
    priority: 7,
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
  },
  LEGISLATIVE_AIDE: {
    label: 'Legislative Aide',
    priority: 8,
    color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100',
  },
  ADMINISTRATIVE_ASSISTANT: {
    label: 'Administrative Assistant',
    priority: 9,
    color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100',
  },
  INTERN: {
    label: 'Intern',
    priority: 10,
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
  },
  OTHER: {
    label: 'Other',
    priority: 11,
    color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
  },
};

interface StaffPositionBadgeProps {
  position: StaffRole;
  customPosition?: string | null;
  isPrimary?: boolean;
  className?: string;
}

export function StaffPositionBadge({
  position,
  customPosition,
  isPrimary,
  className,
}: StaffPositionBadgeProps) {
  const config = staffRoleConfig[position];
  const label = position === 'OTHER' && customPosition ? customPosition : config.label;

  return (
    <Badge
      className={cn(
        'border-transparent',
        config.color,
        isPrimary && 'ring-2 ring-offset-1 ring-primary/50',
        className
      )}
    >
      {isPrimary && (
        <span className="mr-1 text-[10px]" title="Primary contact">
          *
        </span>
      )}
      {label}
    </Badge>
  );
}

// Helper to sort staff positions by priority
export function sortStaffByPriority<
  T extends { position: StaffRole; isPrimary?: boolean }
>(staff: T[]): T[] {
  return [...staff].sort((a, b) => {
    // Primary contacts first
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    // Then by position priority
    return staffRoleConfig[a.position].priority - staffRoleConfig[b.position].priority;
  });
}
