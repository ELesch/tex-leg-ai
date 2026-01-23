import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { StaffRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { contactId: string };
}

// GET /api/contacts/[contactId]/positions - Get staff positions for a contact
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactId } = params;
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    // Check ownership
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId: session.user.id,
      },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const where: { contactId: string; isActive?: boolean } = { contactId };
    if (activeOnly) {
      where.isActive = true;
    }

    const positions = await prisma.staffPosition.findMany({
      where,
      orderBy: [
        { isPrimary: 'desc' },
        { position: 'asc' },
      ],
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
    });

    return NextResponse.json({
      positions: positions.map(p => ({
        id: p.id,
        position: p.position,
        customPosition: p.customPosition,
        isPrimary: p.isPrimary,
        isActive: p.isActive,
        startDate: p.startDate,
        endDate: p.endDate,
        author: p.author,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching staff positions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/contacts/[contactId]/positions - Create a staff position
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactId } = params;

    // Check ownership
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId: session.user.id,
      },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      authorId,
      position,
      customPosition,
      isPrimary,
      startDate,
      endDate,
    } = body;

    if (!authorId) {
      return NextResponse.json(
        { error: 'Author ID is required' },
        { status: 400 }
      );
    }

    if (!position || !Object.values(StaffRole).includes(position)) {
      return NextResponse.json(
        { error: 'Valid position is required' },
        { status: 400 }
      );
    }

    // Check author exists
    const author = await prisma.author.findUnique({
      where: { id: authorId },
    });

    if (!author) {
      return NextResponse.json({ error: 'Author not found' }, { status: 404 });
    }

    // Check for existing position
    const existing = await prisma.staffPosition.findUnique({
      where: {
        contactId_authorId_position: {
          contactId,
          authorId,
          position,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'This position already exists for this author' },
        { status: 409 }
      );
    }

    // If setting as primary, unset other primary positions for this author
    if (isPrimary) {
      await prisma.staffPosition.updateMany({
        where: {
          authorId,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    const staffPosition = await prisma.staffPosition.create({
      data: {
        contactId,
        authorId,
        position,
        customPosition: position === 'OTHER' ? customPosition?.trim() || null : null,
        isPrimary: isPrimary || false,
        isActive: true,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
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
    });

    return NextResponse.json({ position: staffPosition }, { status: 201 });
  } catch (error) {
    console.error('Error creating staff position:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/contacts/[contactId]/positions - Update a staff position
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactId } = params;

    // Check ownership
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId: session.user.id,
      },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      positionId,
      customPosition,
      isPrimary,
      isActive,
      startDate,
      endDate,
    } = body;

    if (!positionId) {
      return NextResponse.json(
        { error: 'Position ID is required' },
        { status: 400 }
      );
    }

    // Check position exists and belongs to this contact
    const existing = await prisma.staffPosition.findFirst({
      where: {
        id: positionId,
        contactId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 });
    }

    // If setting as primary, unset other primary positions for this author
    if (isPrimary === true) {
      await prisma.staffPosition.updateMany({
        where: {
          authorId: existing.authorId,
          isPrimary: true,
          id: { not: positionId },
        },
        data: {
          isPrimary: false,
        },
      });
    }

    const updateData: {
      customPosition?: string | null;
      isPrimary?: boolean;
      isActive?: boolean;
      startDate?: Date | null;
      endDate?: Date | null;
    } = {};

    if (customPosition !== undefined) {
      updateData.customPosition = existing.position === 'OTHER' ? customPosition?.trim() || null : null;
    }
    if (isPrimary !== undefined) {
      updateData.isPrimary = isPrimary;
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }
    if (startDate !== undefined) {
      updateData.startDate = startDate ? new Date(startDate) : null;
    }
    if (endDate !== undefined) {
      updateData.endDate = endDate ? new Date(endDate) : null;
    }

    const staffPosition = await prisma.staffPosition.update({
      where: { id: positionId },
      data: updateData,
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
    });

    return NextResponse.json({ position: staffPosition });
  } catch (error) {
    console.error('Error updating staff position:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/contacts/[contactId]/positions - Delete a staff position
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactId } = params;
    const { searchParams } = new URL(request.url);
    const positionId = searchParams.get('positionId');

    if (!positionId) {
      return NextResponse.json(
        { error: 'Position ID is required' },
        { status: 400 }
      );
    }

    // Check ownership
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId: session.user.id,
      },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Check position exists and belongs to this contact
    const existing = await prisma.staffPosition.findFirst({
      where: {
        id: positionId,
        contactId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 });
    }

    await prisma.staffPosition.delete({
      where: { id: positionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting staff position:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
