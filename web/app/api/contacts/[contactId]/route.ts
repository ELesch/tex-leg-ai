import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { contactId: string };
}

// GET /api/contacts/[contactId] - Get contact details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactId } = params;

    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId: session.user.id,
      },
      include: {
        staffPositions: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                displayName: true,
                chamber: true,
                district: true,
                party: true,
              },
            },
          },
          orderBy: [
            { isPrimary: 'desc' },
            { position: 'asc' },
          ],
        },
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
        sharedWith: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        _count: {
          select: {
            notes: true,
            staffPositions: true,
            sharedWith: true,
          },
        },
      },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    return NextResponse.json({
      contact: {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        displayName: contact.displayName,
        email: contact.email,
        phone: contact.phone,
        mobilePhone: contact.mobilePhone,
        address: contact.address,
        title: contact.title,
        organization: contact.organization,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
        noteCount: contact._count.notes,
        staffPositionCount: contact._count.staffPositions,
        sharedCount: contact._count.sharedWith,
        staffPositions: contact.staffPositions.map(sp => ({
          id: sp.id,
          position: sp.position,
          customPosition: sp.customPosition,
          isPrimary: sp.isPrimary,
          isActive: sp.isActive,
          startDate: sp.startDate,
          endDate: sp.endDate,
          author: sp.author,
        })),
        recentNotes: contact.notes.map(n => ({
          id: n.id,
          content: n.content,
          mentions: n.mentions,
          createdAt: n.createdAt,
          updatedAt: n.updatedAt,
          user: n.user,
        })),
        sharedWith: contact.sharedWith.map(s => ({
          id: s.id,
          team: s.team,
          sharedAt: s.sharedAt,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching contact:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/contacts/[contactId] - Update contact
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactId } = params;

    // Check ownership
    const existing = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
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

    const updateData: Record<string, string | null> = {};

    if (firstName !== undefined) {
      if (!firstName || typeof firstName !== 'string' || firstName.trim().length === 0) {
        return NextResponse.json(
          { error: 'First name cannot be empty' },
          { status: 400 }
        );
      }
      updateData.firstName = firstName.trim();
    }
    if (lastName !== undefined) {
      if (!lastName || typeof lastName !== 'string' || lastName.trim().length === 0) {
        return NextResponse.json(
          { error: 'Last name cannot be empty' },
          { status: 400 }
        );
      }
      updateData.lastName = lastName.trim();
    }
    if (displayName !== undefined) {
      updateData.displayName = displayName?.trim() || null;
    }
    if (email !== undefined) {
      updateData.email = email?.trim() || null;
    }
    if (phone !== undefined) {
      updateData.phone = phone?.trim() || null;
    }
    if (mobilePhone !== undefined) {
      updateData.mobilePhone = mobilePhone?.trim() || null;
    }
    if (address !== undefined) {
      updateData.address = address?.trim() || null;
    }
    if (title !== undefined) {
      updateData.title = title?.trim() || null;
    }
    if (organization !== undefined) {
      updateData.organization = organization?.trim() || null;
    }

    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: updateData,
    });

    return NextResponse.json({ contact });
  } catch (error) {
    console.error('Error updating contact:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/contacts/[contactId] - Delete contact
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactId } = params;

    // Check ownership
    const existing = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    await prisma.contact.delete({
      where: { id: contactId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting contact:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
