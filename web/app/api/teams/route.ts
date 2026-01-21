import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { generateSlug, ensureUniqueSlug } from '@/lib/teams/permissions';

// GET /api/teams - List user's teams
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const memberships = await prisma.teamMembership.findMany({
      where: { userId: session.user.id },
      include: {
        team: {
          include: {
            _count: {
              select: {
                memberships: true,
                workspaces: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const teams = memberships.map(m => ({
      id: m.team.id,
      name: m.team.name,
      description: m.team.description,
      slug: m.team.slug,
      role: m.role,
      joinedAt: m.joinedAt,
      memberCount: m.team._count.memberships,
      workspaceCount: m.team._count.workspaces,
      createdAt: m.team.createdAt,
    }));

    return NextResponse.json({ teams });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/teams - Create a new team
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, description } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Team name is required' },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Team name must be less than 100 characters' },
        { status: 400 }
      );
    }

    // Generate unique slug
    const baseSlug = generateSlug(name.trim());
    const slug = await ensureUniqueSlug(baseSlug);

    // Create team and add creator as owner
    const team = await prisma.team.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        slug,
        memberships: {
          create: {
            userId: session.user.id,
            role: 'OWNER',
          },
        },
      },
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
            memberships: true,
            workspaces: true,
          },
        },
      },
    });

    // Log activity
    await prisma.teamActivity.create({
      data: {
        teamId: team.id,
        userId: session.user.id,
        type: 'MEMBER_JOINED',
        entityType: 'team',
        entityId: team.id,
        metadata: { role: 'OWNER', action: 'created' },
      },
    });

    return NextResponse.json(
      {
        team: {
          id: team.id,
          name: team.name,
          description: team.description,
          slug: team.slug,
          memberCount: team._count.memberships,
          workspaceCount: team._count.workspaces,
          createdAt: team.createdAt,
          members: team.memberships.map(m => ({
            userId: m.user.id,
            name: m.user.name,
            email: m.user.email,
            image: m.user.image,
            role: m.role,
            joinedAt: m.joinedAt,
          })),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating team:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
