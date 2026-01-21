'use client';

import { useState } from 'react';
import { TeamRole } from '@prisma/client';
import { MoreHorizontal, UserMinus, Shield, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface Member {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  role: TeamRole;
  joinedAt: string;
}

interface TeamMembersProps {
  teamId: string;
  members: Member[];
  currentUserRole: TeamRole;
  currentUserId: string;
  onMemberUpdated: () => void;
}

const roleLabels: Record<TeamRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  CONTRIBUTOR: 'Contributor',
  REVIEWER: 'Reviewer',
  VIEWER: 'Viewer',
};

const roleIcons: Record<TeamRole, React.ReactNode> = {
  OWNER: <Crown className="h-3 w-3" />,
  ADMIN: <Shield className="h-3 w-3" />,
  CONTRIBUTOR: null,
  REVIEWER: null,
  VIEWER: null,
};

const roleColors: Record<TeamRole, string> = {
  OWNER: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  ADMIN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  CONTRIBUTOR: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  REVIEWER: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  VIEWER: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};

export function TeamMembers({
  teamId,
  members,
  currentUserRole,
  currentUserId,
  onMemberUpdated,
}: TeamMembersProps) {
  const { toast } = useToast();
  const [updatingMember, setUpdatingMember] = useState<string | null>(null);

  const canManageMembers = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';
  const canAssignAdmin = currentUserRole === 'OWNER';

  const handleRoleChange = async (userId: string, newRole: TeamRole) => {
    setUpdatingMember(userId);
    try {
      const response = await fetch(`/api/teams/${teamId}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update role');
      }

      toast({
        title: 'Role updated',
        description: 'Member role has been updated successfully.',
      });
      onMemberUpdated();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update role',
        variant: 'destructive',
      });
    } finally {
      setUpdatingMember(null);
    }
  };

  const handleRemoveMember = async (userId: string, memberName: string | null) => {
    if (!confirm(`Are you sure you want to remove ${memberName || 'this member'} from the team?`)) {
      return;
    }

    setUpdatingMember(userId);
    try {
      const response = await fetch(`/api/teams/${teamId}/members/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove member');
      }

      toast({
        title: 'Member removed',
        description: 'Member has been removed from the team.',
      });
      onMemberUpdated();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove member',
        variant: 'destructive',
      });
    } finally {
      setUpdatingMember(null);
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  return (
    <div className="space-y-4">
      {members.map((member) => {
        const isOwner = member.role === 'OWNER';
        const isSelf = member.userId === currentUserId;
        const canModify = canManageMembers && !isOwner && !isSelf;
        const canChangeRole = canModify && (canAssignAdmin || member.role !== 'ADMIN');

        return (
          <div
            key={member.id}
            className="flex items-center justify-between p-3 rounded-lg border"
          >
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={member.image || undefined} />
                <AvatarFallback>
                  {getInitials(member.name, member.email)}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {member.name || member.email}
                  </span>
                  {isSelf && (
                    <Badge variant="outline" className="text-xs">
                      You
                    </Badge>
                  )}
                </div>
                {member.name && (
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canChangeRole ? (
                <Select
                  value={member.role}
                  onValueChange={(value) => handleRoleChange(member.userId, value as TeamRole)}
                  disabled={updatingMember === member.userId}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {canAssignAdmin && (
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    )}
                    <SelectItem value="CONTRIBUTOR">Contributor</SelectItem>
                    <SelectItem value="REVIEWER">Reviewer</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge className={roleColors[member.role]} variant="secondary">
                  <span className="flex items-center gap-1">
                    {roleIcons[member.role]}
                    {roleLabels[member.role]}
                  </span>
                </Badge>
              )}

              {(canModify || isSelf) && !isOwner && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={updatingMember === member.userId}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isSelf && (
                      <DropdownMenuItem
                        onClick={() => handleRemoveMember(member.userId, member.name)}
                        className="text-destructive"
                      >
                        <UserMinus className="mr-2 h-4 w-4" />
                        Leave Team
                      </DropdownMenuItem>
                    )}
                    {canModify && (
                      <DropdownMenuItem
                        onClick={() => handleRemoveMember(member.userId, member.name)}
                        className="text-destructive"
                      >
                        <UserMinus className="mr-2 h-4 w-4" />
                        Remove from Team
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
