import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ contactId: string }>;
}

// POST /api/contacts/[contactId]/share - Share contact with a team
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactId } = await params;

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
    const { teamId } = body;

    if (!teamId) {
      return NextResponse.json(
        { error: 'Team ID is required' },
        { status: 400 }
      );
    }

    // Check user is a member of the team
    const membership = await prisma.teamMembership.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You are not a member of this team' },
        { status: 403 }
      );
    }

    // Check if already shared
    const existing = await prisma.sharedContact.findUnique({
      where: {
        contactId_teamId: {
          contactId,
          teamId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Contact is already shared with this team' },
        { status: 409 }
      );
    }

    const sharedContact = await prisma.sharedContact.create({
      data: {
        contactId,
        teamId,
        sharedBy: session.user.id,
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        sharedContact: {
          id: sharedContact.id,
          team: sharedContact.team,
          sharedAt: sharedContact.sharedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error sharing contact:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/contacts/[contactId]/share - Unshare contact from a team
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactId } = await params;
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json(
        { error: 'Team ID is required' },
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

    // Check if shared
    const existing = await prisma.sharedContact.findUnique({
      where: {
        contactId_teamId: {
          contactId,
          teamId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Contact is not shared with this team' },
        { status: 404 }
      );
    }

    await prisma.sharedContact.delete({
      where: {
        contactId_teamId: {
          contactId,
          teamId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unsharing contact:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
