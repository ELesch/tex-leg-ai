'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StaffPositionBadge } from './staff-position-badge';
import { Mail, Phone, Building2, Edit2, Trash2, Share2 } from 'lucide-react';
import { StaffRole, Chamber } from '@prisma/client';
import { cn } from '@/lib/utils';

interface ContactAuthor {
  id: string;
  name: string;
  displayName: string | null;
  chamber: Chamber | null;
}

interface ContactStaffPosition {
  id: string;
  position: StaffRole;
  customPosition: string | null;
  isPrimary: boolean;
  author: ContactAuthor;
}

interface ContactCardProps {
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
    email: string | null;
    phone: string | null;
    mobilePhone: string | null;
    title: string | null;
    organization: string | null;
    staffPositions?: ContactStaffPosition[];
  };
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  className?: string;
  compact?: boolean;
}

export function ContactCard({
  contact,
  onEdit,
  onDelete,
  onShare,
  className,
  compact = false,
}: ContactCardProps) {
  const fullName =
    contact.displayName || `${contact.firstName} ${contact.lastName}`;

  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardHeader className={cn('pb-2', compact && 'p-3 pb-1')}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className={cn('text-base font-medium truncate', compact && 'text-sm')}>
              {fullName}
            </CardTitle>
            {contact.title && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {contact.title}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onShare && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onShare}
                title="Share contact"
              >
                <Share2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onEdit}
                title="Edit contact"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={onDelete}
                title="Delete contact"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn('space-y-2', compact && 'p-3 pt-0')}>
        {contact.organization && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{contact.organization}</span>
          </div>
        )}

        {contact.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <a
              href={`mailto:${contact.email}`}
              className="truncate text-primary hover:underline"
            >
              {contact.email}
            </a>
          </div>
        )}

        {(contact.phone || contact.mobilePhone) && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="flex gap-2 flex-wrap">
              {contact.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className="text-primary hover:underline"
                >
                  {contact.phone}
                </a>
              )}
              {contact.mobilePhone && (
                <a
                  href={`tel:${contact.mobilePhone}`}
                  className="text-primary hover:underline"
                >
                  {contact.mobilePhone}
                  <span className="text-xs text-muted-foreground ml-1">(mobile)</span>
                </a>
              )}
            </div>
          </div>
        )}

        {contact.staffPositions && contact.staffPositions.length > 0 && (
          <div className="pt-2 space-y-1.5">
            {contact.staffPositions.map((sp) => (
              <div key={sp.id} className="flex items-center gap-2 flex-wrap">
                <StaffPositionBadge
                  position={sp.position}
                  customPosition={sp.customPosition}
                  isPrimary={sp.isPrimary}
                />
                <span className="text-xs text-muted-foreground">
                  for {sp.author.displayName || sp.author.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
