import { TeamRole } from '@prisma/client';
import { prisma } from '../db/prisma';

/**
 * Team role hierarchy (higher number = more permissions)
 */
export const ROLE_HIERARCHY: Record<TeamRole, number> = {
  VIEWER: 1,
  REVIEWER: 2,
  CONTRIBUTOR: 3,
  ADMIN: 4,
  OWNER: 5,
};

/**
 * Check if a role has at least the required permission level
 */
export function hasPermission(userRole: TeamRole, requiredRole: TeamRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Permission checks for specific actions
 */
export const TeamPermissions = {
  // Team management
  canEditTeam: (role: TeamRole) => hasPermission(role, 'ADMIN'),
  canDeleteTeam: (role: TeamRole) => role === 'OWNER',
  canManageMembers: (role: TeamRole) => hasPermission(role, 'ADMIN'),
  canInviteMembers: (role: TeamRole) => hasPermission(role, 'ADMIN'),
  canChangeAiSettings: (role: TeamRole) => hasPermission(role, 'ADMIN'),

  // Workspace management
  canCreateWorkspace: (role: TeamRole) => hasPermission(role, 'CONTRIBUTOR'),
  canDeleteWorkspace: (role: TeamRole) => hasPermission(role, 'ADMIN'),
  canChangeStatus: (role: TeamRole) => hasPermission(role, 'REVIEWER'),
  canAssignMembers: (role: TeamRole) => hasPermission(role, 'REVIEWER'),

  // Comments and annotations
  canComment: (role: TeamRole) => hasPermission(role, 'CONTRIBUTOR'),
  canAnnotate: (role: TeamRole) => hasPermission(role, 'CONTRIBUTOR'),
  canResolveAnnotations: (role: TeamRole) => hasPermission(role, 'REVIEWER'),

  // Chat
  canChat: (role: TeamRole) => hasPermission(role, 'CONTRIBUTOR'),

  // View permissions
  canView: (role: TeamRole) => hasPermission(role, 'VIEWER'),
};

/**
 * Get user's membership in a team
 */
export async function getTeamMembership(teamId: string, userId: string) {
  return prisma.teamMembership.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId,
      },
    },
    include: {
      team: true,
    },
  });
}

/**
 * Get user's role in a team
 */
export async function getTeamRole(teamId: string, userId: string): Promise<TeamRole | null> {
  const membership = await getTeamMembership(teamId, userId);
  return membership?.role ?? null;
}

/**
 * Check if user is a team member
 */
export async function isTeamMember(teamId: string, userId: string): Promise<boolean> {
  const membership = await getTeamMembership(teamId, userId);
  return !!membership;
}

/**
 * Get team by slug with membership check
 */
export async function getTeamBySlug(slug: string, userId?: string) {
  const team = await prisma.team.findUnique({
    where: { slug },
    include: {
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
      _count: {
        select: {
          workspaces: true,
          memberships: true,
        },
      },
    },
  });

  if (!team) return null;

  // If userId provided, check membership
  if (userId) {
    const isMember = team.memberships.some(m => m.userId === userId);
    if (!isMember) return null;
  }

  return team;
}

/**
 * Generate a slug from a team name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 50);
}

/**
 * Ensure unique slug by appending a number if needed
 */
export async function ensureUniqueSlug(baseSlug: string, excludeTeamId?: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.team.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing || existing.id === excludeTeamId) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;

    // Safety limit
    if (counter > 100) {
      slug = `${baseSlug}-${Date.now()}`;
      return slug;
    }
  }
}

/**
 * Get team owner
 */
export async function getTeamOwner(teamId: string) {
  const ownerMembership = await prisma.teamMembership.findFirst({
    where: {
      teamId,
      role: 'OWNER',
    },
    include: {
      user: true,
    },
  });

  return ownerMembership?.user ?? null;
}
