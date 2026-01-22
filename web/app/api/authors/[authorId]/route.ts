import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ authorId: string }>;
}

// GET /api/authors/[authorId] - Get author details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { authorId } = await params;

    const author = await prisma.author.findUnique({
      where: { id: authorId },
      include: {
        staffPositions: {
          where: { isActive: true },
          include: {
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
                email: true,
                phone: true,
                title: true,
              },
            },
          },
          orderBy: [
            { isPrimary: 'desc' },
            { position: 'asc' },
          ],
        },
        _count: {
          select: {
            staffPositions: true,
            userContacts: true,
          },
        },
      },
    });

    if (!author) {
      return NextResponse.json({ error: 'Author not found' }, { status: 404 });
    }

    // Get user's personal contact for this author if exists
    const userContact = await prisma.userContact.findUnique({
      where: {
        userId_authorId: {
          userId: session.user.id,
          authorId: author.id,
        },
      },
    });

    return NextResponse.json({
      author: {
        id: author.id,
        name: author.name,
        displayName: author.displayName,
        chamber: author.chamber,
        district: author.district,
        party: author.party,
        email: author.email,
        phone: author.phone,
        officeAddress: author.officeAddress,
        capitolOffice: author.capitolOffice,
        websiteUrl: author.websiteUrl,
        photoUrl: author.photoUrl,
        createdAt: author.createdAt,
        updatedAt: author.updatedAt,
        staffCount: author._count.staffPositions,
        userContactCount: author._count.userContacts,
        staff: author.staffPositions.map(sp => ({
          id: sp.id,
          position: sp.position,
          customPosition: sp.customPosition,
          isPrimary: sp.isPrimary,
          contact: sp.contact,
        })),
        userContact: userContact
          ? {
              id: userContact.id,
              personalEmail: userContact.personalEmail,
              personalPhone: userContact.personalPhone,
              personalNotes: userContact.personalNotes,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Error fetching author:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/authors/[authorId] - Update author
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { authorId } = await params;

    // Check if author exists
    const existing = await prisma.author.findUnique({
      where: { id: authorId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Author not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
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

    const updateData: Record<string, string | null> = {};

    if (displayName !== undefined) {
      updateData.displayName = displayName?.trim() || null;
    }
    if (chamber !== undefined) {
      updateData.chamber = chamber || null;
    }
    if (district !== undefined) {
      updateData.district = district?.trim() || null;
    }
    if (party !== undefined) {
      updateData.party = party?.trim() || null;
    }
    if (email !== undefined) {
      updateData.email = email?.trim() || null;
    }
    if (phone !== undefined) {
      updateData.phone = phone?.trim() || null;
    }
    if (officeAddress !== undefined) {
      updateData.officeAddress = officeAddress?.trim() || null;
    }
    if (capitolOffice !== undefined) {
      updateData.capitolOffice = capitolOffice?.trim() || null;
    }
    if (websiteUrl !== undefined) {
      updateData.websiteUrl = websiteUrl?.trim() || null;
    }
    if (photoUrl !== undefined) {
      updateData.photoUrl = photoUrl?.trim() || null;
    }

    const author = await prisma.author.update({
      where: { id: authorId },
      data: updateData,
    });

    return NextResponse.json({ author });
  } catch (error) {
    console.error('Error updating author:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
