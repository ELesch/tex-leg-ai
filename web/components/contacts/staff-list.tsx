'use client';

import { StaffPositionBadge, sortStaffByPriority } from './staff-position-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Phone, Plus, UserPlus } from 'lucide-react';
import { StaffRole } from '@prisma/client';
import { cn } from '@/lib/utils';

interface StaffContact {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
}

interface StaffPosition {
  id: string;
  position: StaffRole;
  customPosition: string | null;
  isPrimary: boolean;
  contact: StaffContact;
}

interface StaffListProps {
  staff: StaffPosition[];
  onAddStaff?: () => void;
  onContactClick?: (contactId: string) => void;
  className?: string;
  emptyMessage?: string;
}

export function StaffList({
  staff,
  onAddStaff,
  onContactClick,
  className,
  emptyMessage = 'No staff contacts added yet',
}: StaffListProps) {
  const sortedStaff = sortStaffByPriority(staff);

  if (staff.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <UserPlus className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground mb-4">{emptyMessage}</p>
          {onAddStaff && (
            <Button variant="outline" size="sm" onClick={onAddStaff}>
              <Plus className="h-4 w-4 mr-1" />
              Add Staff Contact
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Staff Contacts</CardTitle>
          {onAddStaff && (
            <Button variant="ghost" size="sm" onClick={onAddStaff} className="h-7">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedStaff.map((sp) => {
          const fullName =
            sp.contact.displayName ||
            `${sp.contact.firstName} ${sp.contact.lastName}`;

          return (
            <div
              key={sp.id}
              className={cn(
                'p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors',
                onContactClick && 'cursor-pointer'
              )}
              onClick={() => onContactClick?.(sp.contact.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{fullName}</span>
                    <StaffPositionBadge
                      position={sp.position}
                      customPosition={sp.customPosition}
                      isPrimary={sp.isPrimary}
                    />
                  </div>
                  {sp.contact.title && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {sp.contact.title}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 mt-2 text-xs">
                {sp.contact.email && (
                  <a
                    href={`mailto:${sp.contact.email}`}
                    className="flex items-center gap-1 text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Mail className="h-3 w-3" />
                    <span className="truncate max-w-[150px]">{sp.contact.email}</span>
                  </a>
                )}
                {sp.contact.phone && (
                  <a
                    href={`tel:${sp.contact.phone}`}
                    className="flex items-center gap-1 text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="h-3 w-3" />
                    <span>{sp.contact.phone}</span>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
