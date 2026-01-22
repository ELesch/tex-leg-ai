import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// GET /api/contacts - List user's contacts
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const authorId = searchParams.get('authorId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build where clause
    interface WhereClause {
      userId: string;
      OR?: Array<{
        firstName?: { contains: string; mode: 'insensitive' };
        lastName?: { contains: string; mode: 'insensitive' };
        email?: { contains: string; mode: 'insensitive' };
        organization?: { contains: string; mode: 'insensitive' };
      }>;
      staffPositions?: { some: { authorId: string } };
    }

    const where: WhereClause = {
      userId: session.user.id,
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { organization: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (authorId) {
      where.staffPositions = { some: { authorId } };
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        take: Math.min(limit, 100),
        skip: offset,
        include: {
          staffPositions: {
            where: { isActive: true },
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  chamber: true,
                },
              },
            },
          },
          _count: {
            select: {
              notes: true,
              sharedWith: true,
            },
          },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    return NextResponse.json({
      contacts: contacts.map(c => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        displayName: c.displayName,
        email: c.email,
        phone: c.phone,
        mobilePhone: c.mobilePhone,
        address: c.address,
        title: c.title,
        organization: c.organization,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        noteCount: c._count.notes,
        sharedCount: c._count.sharedWith,
        staffPositions: c.staffPositions.map(sp => ({
          id: sp.id,
          position: sp.position,
          customPosition: sp.customPosition,
          isPrimary: sp.isPrimary,
          author: sp.author,
        })),
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/contacts - Create a contact
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      firstName,
      lastName,
      displayName,
      email,
      phone,
      mobilePhone,
      address,
      title,
      organization,
    } = body;

    if (!firstName || typeof firstName !== 'string' || firstName.trim().length === 0) {
      return NextResponse.json(
        { error: 'First name is required' },
        { status: 400 }
      );
    }

    if (!lastName || typeof lastName !== 'string' || lastName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Last name is required' },
        { status: 400 }
      );
    }

    const contact = await prisma.contact.create({
      data: {
        userId: session.user.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: displayName?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        mobilePhone: mobilePhone?.trim() || null,
        address: address?.trim() || null,
        title: title?.trim() || null,
        organization: organization?.trim() || null,
      },
      include: {
        _count: {
          select: {
            notes: true,
            sharedWith: true,
          },
        },
      },
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    console.error('Error creating contact:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
