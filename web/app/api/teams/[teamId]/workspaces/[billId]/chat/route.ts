import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { getTeamMembership, TeamPermissions, getTeamOwner } from '@/lib/teams/permissions';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, LanguageModel } from 'ai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ teamId: string; billId: string }>;
}

// Default models for each provider
const DEFAULT_MODELS = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-5-20250929',
  google: 'gemini-2.5-flash',
};

// Create OpenAI model instance with custom API key
function createOpenAIModel(apiKey: string, model: string): LanguageModel {
  const openai = createOpenAI({ apiKey });
  return openai(model);
}

// Create a streaming response for Anthropic
async function streamAnthropicResponse(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  onFinish: (text: string) => Promise<void>
): Promise<Response> {
  const client = new Anthropic({ apiKey });

  const anthropicMessages = messages.map((msg) => ({
    role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
    content: msg.content,
  }));

  const stream = await client.messages.stream({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: anthropicMessages,
  });

  const encoder = new TextEncoder();
  let fullText = '';

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const text = event.delta.text;
            fullText += text;
            const data = `0:${JSON.stringify(text)}\n`;
            controller.enqueue(encoder.encode(data));
          }
        }
        const finishData = `d:{"finishReason":"stop"}\n`;
        controller.enqueue(encoder.encode(finishData));
        controller.close();
        await onFinish(fullText);
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Vercel-AI-Data-Stream': 'v1',
    },
  });
}

// Create a streaming response for Google GenAI
async function streamGoogleResponse(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  onFinish: (text: string) => Promise<void>
): Promise<Response> {
  const genai = new GoogleGenAI({ apiKey });

  const googleMessages = messages.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  const response = await genai.models.generateContentStream({
    model,
    contents: googleMessages,
    config: {
      systemInstruction: systemPrompt,
    },
  });

  const encoder = new TextEncoder();
  let fullText = '';

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of response) {
          const text = chunk.text || '';
          if (text) {
            fullText += text;
            const data = `0:${JSON.stringify(text)}\n`;
            controller.enqueue(encoder.encode(data));
          }
        }
        const finishData = `d:{"finishReason":"stop"}\n`;
        controller.enqueue(encoder.encode(finishData));
        controller.close();
        await onFinish(fullText);
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Vercel-AI-Data-Stream': 'v1',
    },
  });
}

// GET - Fetch team chat history
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { teamId, billId } = await params;

    // Check membership
    const membership = await getTeamMembership(teamId, session.user.id);
    if (!membership) {
      return new Response('Team not found', { status: 404 });
    }

    // Find the bill
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { id: true },
    });

    if (!bill) {
      return new Response('Bill not found', { status: 404 });
    }

    const workspace = await prisma.teamWorkspace.findUnique({
      where: {
        teamId_billId: {
          teamId,
          billId: bill.id,
        },
      },
      include: {
        chatSession: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!workspace) {
      return new Response('Workspace not found', { status: 404 });
    }

    return Response.json({
      messages: workspace.chatSession?.messages || [],
    });
  } catch (error) {
    console.error('Error fetching chat:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

// POST - Send message to team chat
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { teamId, billId } = await params;

    // Check membership and permissions
    const membership = await getTeamMembership(teamId, session.user.id);
    if (!membership) {
      return new Response('Team not found', { status: 404 });
    }

    if (!TeamPermissions.canChat(membership.role)) {
      return new Response('Forbidden', { status: 403 });
    }

    const { messages } = await request.json();

    // Find the bill
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: {
        id: true,
        billId: true,
        description: true,
        content: true,
        status: true,
        authors: true,
        lastAction: true,
      },
    });

    if (!bill) {
      return new Response('Bill not found', { status: 404 });
    }

    // Get workspace
    const workspace = await prisma.teamWorkspace.findUnique({
      where: {
        teamId_billId: {
          teamId,
          billId: bill.id,
        },
      },
    });

    if (!workspace) {
      return new Response('Workspace not found', { status: 404 });
    }

    // Get or create team chat session
    let chatSession = await prisma.teamChatSession.findUnique({
      where: { workspaceId: workspace.id },
    });

    if (!chatSession) {
      chatSession = await prisma.teamChatSession.create({
        data: { workspaceId: workspace.id },
      });
    }

    // Get team settings for AI
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        aiProvider: true,
        aiModel: true,
        aiApiKey: true,
      },
    });

    // Determine AI settings (team -> owner -> user)
    let provider = team?.aiProvider;
    let model = team?.aiModel;
    let apiKey = team?.aiApiKey;

    // If team doesn't have settings, try owner's settings
    if (!apiKey) {
      const owner = await getTeamOwner(teamId);
      if (owner) {
        const ownerSettings = await prisma.user.findUnique({
          where: { id: owner.id },
          select: {
            aiProvider: true,
            aiModel: true,
            aiApiKey: true,
          },
        });

        if (ownerSettings?.aiApiKey) {
          provider = provider || ownerSettings.aiProvider;
          model = model || ownerSettings.aiModel;
          apiKey = ownerSettings.aiApiKey;
        }
      }
    }

    // If still no API key, try current user's settings
    if (!apiKey) {
      const userSettings = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          aiProvider: true,
          aiModel: true,
          aiApiKey: true,
        },
      });

      if (userSettings?.aiApiKey) {
        provider = provider || userSettings.aiProvider;
        model = model || userSettings.aiModel;
        apiKey = userSettings.aiApiKey;
      }
    }

    // Fallback to environment variable
    if (!apiKey) {
      apiKey = process.env.OPENAI_API_KEY || null;
      provider = provider || 'openai';
    }

    if (!apiKey) {
      return new Response('No AI API key configured. Please configure team AI settings or your personal AI settings.', { status: 400 });
    }

    provider = provider || 'openai';
    model = model || DEFAULT_MODELS[provider as keyof typeof DEFAULT_MODELS] || DEFAULT_MODELS.openai;

    // Build system prompt
    const systemPrompt = `You are an expert assistant helping a team analyze Texas Legislature bills. Multiple team members may be participating in this conversation. You provide accurate, helpful information about bills and their implications.

Current Bill Information:
- Bill ID: ${bill.billId}
- Status: ${bill.status || 'Unknown'}
- Authors: ${bill.authors.join(', ') || 'Not listed'}
- Last Action: ${bill.lastAction || 'None recorded'}

Bill Description:
${bill.description}

${bill.content ? `Full Bill Text:\n${bill.content.slice(0, 15000)}${bill.content.length > 15000 ? '\n\n[Content truncated for length]' : ''}` : 'Full text not available.'}

Instructions:
- Answer questions about this bill accurately and helpfully
- If asked about something not covered in the bill text, say so clearly
- Explain legal/legislative terminology when relevant
- Be concise but thorough
- If you're uncertain, acknowledge it
- Remember this is a shared team conversation - any team member can see the history`;

    // Save user message
    const userMessage = messages[messages.length - 1];
    if (userMessage && userMessage.role === 'user') {
      await prisma.teamChatMessage.create({
        data: {
          chatSessionId: chatSession.id,
          userId: session.user.id,
          role: 'USER',
          content: userMessage.content,
        },
      });

      // Log activity
      await prisma.teamActivity.create({
        data: {
          teamId,
          userId: session.user.id,
          type: 'CHAT_MESSAGE',
          entityType: 'chat',
          entityId: chatSession.id,
          metadata: {
            billId: bill.billId,
            messagePreview: userMessage.content.substring(0, 100),
          },
        },
      });
    }

    // Callback to save assistant response
    const saveAssistantMessage = async (text: string) => {
      await prisma.teamChatMessage.create({
        data: {
          chatSessionId: chatSession!.id,
          userId: null, // AI messages have no user
          role: 'ASSISTANT',
          content: text,
        },
      });
    };

    // Route to appropriate provider
    switch (provider) {
      case 'anthropic': {
        return streamAnthropicResponse(
          apiKey,
          model,
          systemPrompt,
          messages,
          saveAssistantMessage
        );
      }

      case 'google': {
        return streamGoogleResponse(
          apiKey,
          model,
          systemPrompt,
          messages,
          saveAssistantMessage
        );
      }

      case 'openai':
      default: {
        const aiModel = createOpenAIModel(apiKey, model);

        const result = await streamText({
          model: aiModel,
          system: systemPrompt,
          messages,
          onFinish: async ({ text }) => {
            await saveAssistantMessage(text);
          },
        });

        return result.toDataStreamResponse();
      }
    }
  } catch (error) {
    console.error('Team chat API error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
