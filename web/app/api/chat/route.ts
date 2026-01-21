import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, LanguageModel } from 'ai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60;

// Type for user AI settings
interface UserAISettings {
  aiProvider: string | null;
  aiModel: string | null;
  aiApiKey: string | null;
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

  // Convert messages to Anthropic format
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

  // Create a ReadableStream for the response
  const encoder = new TextEncoder();
  let fullText = '';

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const text = event.delta.text;
            fullText += text;
            // Format for Vercel AI SDK data stream protocol
            const data = `0:${JSON.stringify(text)}\n`;
            controller.enqueue(encoder.encode(data));
          }
        }
        // Send finish message
        const finishData = `d:{"finishReason":"stop"}\n`;
        controller.enqueue(encoder.encode(finishData));
        controller.close();

        // Call onFinish after stream completes
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

  // Convert messages to Google format
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

  // Create a ReadableStream for the response
  const encoder = new TextEncoder();
  let fullText = '';

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of response) {
          const text = chunk.text || '';
          if (text) {
            fullText += text;
            // Format for Vercel AI SDK data stream protocol
            const data = `0:${JSON.stringify(text)}\n`;
            controller.enqueue(encoder.encode(data));
          }
        }
        // Send finish message
        const finishData = `d:{"finishReason":"stop"}\n`;
        controller.enqueue(encoder.encode(finishData));
        controller.close();

        // Call onFinish after stream completes
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

export async function POST(request: NextRequest) {
  let provider = 'openai';
  let model = 'unknown';

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { messages, billId } = await request.json();

    if (!billId) {
      return new Response('Bill ID required', { status: 400 });
    }

    // Get user's AI settings
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        aiProvider: true,
        aiModel: true,
        aiApiKey: true,
      },
    });

    // Get bill content for context
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

    // Get or create chat session
    const chatSession = await prisma.chatSession.upsert({
      where: {
        userId_billId: {
          userId: session.user.id,
          billId: bill.id,
        },
      },
      create: {
        userId: session.user.id,
        billId: bill.id,
        title: `Chat about ${bill.billId}`,
      },
      update: {
        updatedAt: new Date(),
      },
    });

    // Build system prompt with bill context
    const systemPrompt = `You are an expert assistant specialized in analyzing Texas Legislature bills. You provide accurate, helpful information about bills and their implications.

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
- If you're uncertain, acknowledge it`;

    // Save user message to database
    const userMessage = messages[messages.length - 1];
    if (userMessage && userMessage.role === 'user') {
      await prisma.chatMessage.create({
        data: {
          chatSessionId: chatSession.id,
          role: 'USER',
          content: userMessage.content,
        },
      });
    }

    // Callback to save assistant response
    const saveAssistantMessage = async (text: string) => {
      await prisma.chatMessage.create({
        data: {
          chatSessionId: chatSession.id,
          role: 'ASSISTANT',
          content: text,
        },
      });
    };

    // Determine which AI provider to use
    provider = user?.aiProvider || 'openai';
    const apiKey = user?.aiApiKey || process.env.OPENAI_API_KEY;
    model = user?.aiModel || DEFAULT_MODELS[provider as keyof typeof DEFAULT_MODELS] || DEFAULT_MODELS.openai;

    // If no API key available at all, return error
    if (!apiKey) {
      return new Response('No AI API key configured. Please configure your AI settings or contact an administrator.', { status: 400 });
    }

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
        // Use Vercel AI SDK for OpenAI (unified interface)
        const aiModel = createOpenAIModel(apiKey, model);

        // GPT-5 models require temperature to be set to 1
        const isGpt5Model = model.startsWith('gpt-5');

        const result = await streamText({
          model: aiModel,
          system: systemPrompt,
          messages,
          temperature: isGpt5Model ? 1 : undefined,
          onFinish: async ({ text }) => {
            await saveAssistantMessage(text);
          },
        });

        return result.toDataStreamResponse();
      }
    }
  } catch (error) {
    // Log the full error with context
    console.error('Chat API error:', { error, provider, model });

    // Extract meaningful error message
    let errorMessage = 'Internal server error';

    if (error instanceof Error) {
      // Check for common API error patterns
      if (error.message.includes('401') || error.message.includes('Unauthorized') || error.message.includes('invalid_api_key')) {
        errorMessage = 'Invalid API key. Please check your API key in settings.';
      } else if (error.message.includes('429') || error.message.includes('rate limit')) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (error.message.includes('model') || error.message.includes('does not exist') || error.message.includes('not found')) {
        errorMessage = `Model "${model}" not available for ${provider}. Error: ${error.message.replace(/sk-[a-zA-Z0-9]+/g, 'sk-***')}`;
      } else if (error.message.includes('insufficient_quota') || error.message.includes('quota')) {
        errorMessage = 'API quota exceeded. Please check your billing settings with your AI provider.';
      } else if (error.message.includes('temperature')) {
        errorMessage = `Temperature configuration error for model "${model}": ${error.message}`;
      } else {
        // Include the actual error for debugging (but sanitize sensitive info)
        errorMessage = `Error with ${provider}/${model}: ${error.message.replace(/sk-[a-zA-Z0-9]+/g, 'sk-***')}`;
      }
    }

    return new Response(errorMessage, { status: 500 });
  }
}
