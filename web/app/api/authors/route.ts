import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { Chamber } from '@prisma/client';

export const dynamic = 'force-dynamic';

// GET /api/authors - List/search authors
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const chamber = searchParams.get('chamber') as Chamber | null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: {
      name?: { contains: string; mode: 'insensitive' };
      chamber?: Chamber;
    } = {};

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (chamber && ['HOUSE', 'SENATE'].includes(chamber)) {
      where.chamber = chamber;
    }

    const [authors, total] = await Promise.all([
      prisma.author.findMany({
        where,
        orderBy: { name: 'asc' },
        take: Math.min(limit, 100),
        skip: offset,
        include: {
          _count: {
            select: {
              staffPositions: true,
              userContacts: true,
            },
          },
        },
      }),
      prisma.author.count({ where }),
    ]);

    return NextResponse.json({
      authors: authors.map(a => ({
        id: a.id,
        name: a.name,
        displayName: a.displayName,
        chamber: a.chamber,
        district: a.district,
        party: a.party,
        email: a.email,
        phone: a.phone,
        officeAddress: a.officeAddress,
        capitolOffice: a.capitolOffice,
        websiteUrl: a.websiteUrl,
        photoUrl: a.photoUrl,
        staffCount: a._count.staffPositions,
        userContactCount: a._count.userContacts,
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching authors:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/authors - Create an author
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      displayName,
      chamber,
      district,
      party,
      email,
      phone,
      officeAddress,
      capitolOffice,
      websiteUrl,
      photoUrl,
    } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Author name is required' },
        { status: 400 }
      );
    }

    // Check if author with same name already exists
    const existing = await prisma.author.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Author with this name already exists' },
        { status: 409 }
      );
    }

    const author = await prisma.author.create({
      data: {
        name: name.trim(),
        displayName: displayName?.trim() || null,
        chamber: chamber || null,
        district: district?.trim() || null,
        party: party?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        officeAddress: officeAddress?.trim() || null,
        capitolOffice: capitolOffice?.trim() || null,
        websiteUrl: websiteUrl?.trim() || null,
        photoUrl: photoUrl?.trim() || null,
      },
    });

    return NextResponse.json({ author }, { status: 201 });
  } catch (error) {
    console.error('Error creating author:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
