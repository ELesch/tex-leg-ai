import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ authorId: string }>;
}

// GET /api/user-contacts/[authorId] - Get user's personal contact for an author
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { authorId } = await params;

    // Check if author exists
    const author = await prisma.author.findUnique({
      where: { id: authorId },
      select: {
        id: true,
        name: true,
        displayName: true,
        chamber: true,
        district: true,
        party: true,
        email: true,
        phone: true,
        officeAddress: true,
        capitolOffice: true,
        websiteUrl: true,
        photoUrl: true,
      },
    });

    if (!author) {
      return NextResponse.json({ error: 'Author not found' }, { status: 404 });
    }

    // Get user's contact for this author
    const userContact = await prisma.userContact.findUnique({
      where: {
        userId_authorId: {
          userId: session.user.id,
          authorId,
        },
      },
      include: {
        notes: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            notes: true,
          },
        },
      },
    });

    return NextResponse.json({
      author,
      userContact: userContact
        ? {
            id: userContact.id,
            personalEmail: userContact.personalEmail,
            personalPhone: userContact.personalPhone,
            personalNotes: userContact.personalNotes,
            createdAt: userContact.createdAt,
            updatedAt: userContact.updatedAt,
            noteCount: userContact._count.notes,
            recentNotes: userContact.notes.map(n => ({
              id: n.id,
              content: n.content,
              mentions: n.mentions,
              createdAt: n.createdAt,
              updatedAt: n.updatedAt,
              user: n.user,
            })),
          }
        : null,
    });
  } catch (error) {
    console.error('Error fetching user contact:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/user-contacts/[authorId] - Create user's personal contact for an author
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { authorId } = await params;

    // Check if author exists
    const author = await prisma.author.findUnique({
      where: { id: authorId },
    });

    if (!author) {
      return NextResponse.json({ error: 'Author not found' }, { status: 404 });
    }

    // Check if user contact already exists
    const existing = await prisma.userContact.findUnique({
      where: {
        userId_authorId: {
          userId: session.user.id,
          authorId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'User contact already exists for this author' },
        { status: 409 }
      );
    }

    const body = await request.json();
    const { personalEmail, personalPhone, personalNotes } = body;

    const userContact = await prisma.userContact.create({
      data: {
        userId: session.user.id,
        authorId,
        personalEmail: personalEmail?.trim() || null,
        personalPhone: personalPhone?.trim() || null,
        personalNotes: personalNotes?.trim() || null,
      },
    });

    return NextResponse.json({ userContact }, { status: 201 });
  } catch (error) {
    console.error('Error creating user contact:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/user-contacts/[authorId] - Update user's personal contact for an author
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { authorId } = await params;

    // Check if user contact exists
    const existing = await prisma.userContact.findUnique({
      where: {
        userId_authorId: {
          userId: session.user.id,
          authorId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'User contact not found' }, { status: 404 });
    }

    const body = await request.json();
    const { personalEmail, personalPhone, personalNotes } = body;

    const updateData: { personalEmail?: string | null; personalPhone?: string | null; personalNotes?: string | null } = {};

    if (personalEmail !== undefined) {
      updateData.personalEmail = personalEmail?.trim() || null;
    }
    if (personalPhone !== undefined) {
      updateData.personalPhone = personalPhone?.trim() || null;
    }
    if (personalNotes !== undefined) {
      updateData.personalNotes = personalNotes?.trim() || null;
    }

    const userContact = await prisma.userContact.update({
      where: {
        userId_authorId: {
          userId: session.user.id,
          authorId,
        },
      },
      data: updateData,
    });

    return NextResponse.json({ userContact });
  } catch (error) {
    console.error('Error updating user contact:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
