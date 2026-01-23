import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { name: string };
}

// GET /api/authors/by-name/[name] - Get author by canonical name
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = params;
    const decodedName = decodeURIComponent(name);

    const author = await prisma.author.findUnique({
      where: { name: decodedName },
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
    console.error('Error fetching author by name:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
