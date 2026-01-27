export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

interface RouteParams {
  params: { id: string };
}

// Zod schema for update validation
const updateMarkerSchema = z.object({
  color: z.enum(['RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE', 'PURPLE']).optional(),
  label: z.string().nullable().optional(),
});

// PUT /api/statutes/markers/[id] - Update a marker
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();

    // Validate request body
    const parseResult = updateMarkerSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    // Find the marker and verify ownership
    const existingMarker = await prisma.statuteMarker.findUnique({
      where: { id },
    });

    if (!existingMarker) {
      return NextResponse.json({ error: 'Marker not found' }, { status: 404 });
    }

    if (existingMarker.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { color, label } = parseResult.data;

    // Build update data
    const updateData: { color?: 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'BLUE' | 'PURPLE'; label?: string | null } = {};
    if (color !== undefined) updateData.color = color;
    if (label !== undefined) updateData.label = label;

    // Update the marker
    const marker = await prisma.statuteMarker.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ marker });
  } catch (error) {
    console.error('Error updating marker:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/statutes/markers/[id] - Delete a marker
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Find the marker and verify ownership
    const existingMarker = await prisma.statuteMarker.findUnique({
      where: { id },
    });

    if (!existingMarker) {
      return NextResponse.json({ error: 'Marker not found' }, { status: 404 });
    }

    if (existingMarker.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the marker
    await prisma.statuteMarker.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting marker:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
