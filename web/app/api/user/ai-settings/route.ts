import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

// Valid models by provider
const validModels = {
  openai: ['gpt-5-2', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-5', 'gpt-5-mini'],
  anthropic: ['claude-opus-4-5-20251101', 'claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-3-pro-preview', 'gemini-3-flash-preview'],
} as const;

type Provider = keyof typeof validModels;

const updateAiSettingsSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google']),
  model: z.string().min(1, 'Model is required'),
  apiKey: z.string().optional(),
}).refine(
  (data) => {
    const providerModels = validModels[data.provider as Provider];
    return providerModels.includes(data.model as never);
  },
  {
    message: 'Invalid model for the selected provider',
    path: ['model'],
  }
);

// GET /api/user/ai-settings - Get current user AI settings
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        aiProvider: true,
        aiModel: true,
        aiApiKey: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      provider: user.aiProvider,
      model: user.aiModel,
      hasApiKey: !!user.aiApiKey,
    });
  } catch (error) {
    console.error('Error fetching AI settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/user/ai-settings - Update user AI settings
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate input
    const result = updateAiSettingsSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const { provider, model, apiKey } = result.data;

    // Build update data - only include apiKey if provided
    const updateData: { aiProvider: string; aiModel: string; aiApiKey?: string } = {
      aiProvider: provider,
      aiModel: model,
    };

    if (apiKey !== undefined) {
      updateData.aiApiKey = apiKey;
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        aiProvider: true,
        aiModel: true,
        aiApiKey: true,
      },
    });

    return NextResponse.json({
      provider: user.aiProvider,
      model: user.aiModel,
      hasApiKey: !!user.aiApiKey,
      message: 'AI settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating AI settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
