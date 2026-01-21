'use client';

import Link from 'next/link';
import { Users, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TeamRole } from '@prisma/client';

interface TeamCardProps {
  team: {
    id: string;
    name: string;
    description: string | null;
    slug: string;
    role: TeamRole;
    memberCount: number;
    workspaceCount: number;
    createdAt: string;
  };
}

const roleColors: Record<TeamRole, string> = {
  OWNER: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  ADMIN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  CONTRIBUTOR: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  REVIEWER: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  VIEWER: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};

export function TeamCard({ team }: TeamCardProps) {
  return (
    <Link href={`/teams/${team.slug}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg">{team.name}</CardTitle>
            <Badge className={roleColors[team.role]} variant="secondary">
              {team.role.toLowerCase()}
            </Badge>
          </div>
          {team.description && (
            <CardDescription className="line-clamp-2">
              {team.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{team.memberCount} member{team.memberCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span>{team.workspaceCount} bill{team.workspaceCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
