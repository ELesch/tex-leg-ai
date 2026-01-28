import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, LanguageModel } from 'ai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60;

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

export async function POST(request: NextRequest) {
  let provider = 'openai';
  let model = 'unknown';

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { messages, codeAbbr, chapterNum, subchapter, billId, sessionId } = await request.json();

    if (!codeAbbr || !chapterNum) {
      return new Response('Code and chapter required', { status: 400 });
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

    // Fetch statute content for context
    const statutes = await prisma.statute.findMany({
      where: {
        code: { abbreviation: codeAbbr },
        chapterNum,
        ...(subchapter ? { subchapter } : {}),
        isCurrent: true,
      },
      include: {
        code: { select: { name: true, abbreviation: true } },
      },
      orderBy: { sectionNum: 'asc' },
    });

    if (statutes.length === 0) {
      return new Response('Statute not found', { status: 404 });
    }

    // Build statute text from sections
    const code = statutes[0].code;
    const chapterTitle = statutes[0].chapterTitle;
    const subchapterTitle = statutes[0].subchapterTitle;
    const statuteText = statutes
      .map(s => `§ ${s.sectionNum}${s.heading ? ` ${s.heading}` : ''}\n${s.text}`)
      .join('\n\n');

    // Fetch bill if provided
    let bill = null;
    let billAction = null;
    if (billId) {
      bill = await prisma.bill.findUnique({
        where: { id: billId },
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

      // Get the action from code references
      if (bill) {
        const codeRef = await prisma.billCodeReference.findFirst({
          where: {
            billId: bill.id,
            code: { contains: codeAbbr },
            chapter: chapterNum,
          },
          select: { action: true },
        });
        billAction = codeRef?.action;
      }
    }

    // Get or create chat session
    let chatSession;
    if (sessionId) {
      chatSession = await prisma.statuteChatSession.findUnique({
        where: { id: sessionId, userId: session.user.id },
      });
      if (!chatSession) {
        return new Response('Session not found', { status: 404 });
      }
    } else {
      // Create new session
      const title = bill
        ? `${bill.billId} & ${codeAbbr} Ch. ${chapterNum}${subchapter ? ` Subch. ${subchapter}` : ''}`
        : `${codeAbbr} Ch. ${chapterNum}${subchapter ? ` Subch. ${subchapter}` : ''}`;

      chatSession = await prisma.statuteChatSession.create({
        data: {
          userId: session.user.id,
          codeAbbr,
          chapterNum,
          subchapter,
          billId: bill?.id,
          title,
        },
      });
    }

    // Build system prompt
    const systemPrompt = `You are an expert assistant analyzing Texas statutes.

Current Statute Context:
- Code: ${code.name} (${code.abbreviation})
- Chapter: ${chapterNum}${chapterTitle ? ` - ${chapterTitle}` : ''}
${subchapter ? `- Subchapter: ${subchapter}${subchapterTitle ? ` - ${subchapterTitle}` : ''}` : ''}

Statute Text:
${statuteText.slice(0, 20000)}${statuteText.length > 20000 ? '\n\n[Content truncated for length]' : ''}
${bill ? `
---
Related Bill: ${bill.billId}
Status: ${bill.status || 'Unknown'}
Authors: ${bill.authors.join(', ') || 'Not listed'}
Last Action: ${bill.lastAction || 'None recorded'}
Action: ${billAction === 'ADD' ? 'Adds to' : billAction === 'AMEND' ? 'Amends' : billAction === 'REPEAL' ? 'Repeals from' : 'Affects'} this chapter

Bill Description:
${bill.description}

Bill Text:
${bill.content?.slice(0, 15000) || 'Full text not available.'}${(bill.content?.length || 0) > 15000 ? '\n\n[Content truncated for length]' : ''}
` : ''}
Instructions:
- Answer questions about this statute accurately and helpfully
${bill ? '- Explain how the bill would change current law when asked' : ''}
- Explain legal terminology when relevant
- Be concise but thorough
- If you're uncertain, acknowledge it`;

    // Save user message to database
    const userMessage = messages[messages.length - 1];
    if (userMessage && userMessage.role === 'user') {
      await prisma.statuteChatMessage.create({
        data: {
          chatSessionId: chatSession.id,
          role: 'USER',
          content: userMessage.content,
        },
      });
    }

    // Update session timestamp
    await prisma.statuteChatSession.update({
      where: { id: chatSession.id },
      data: { updatedAt: new Date() },
    });

    // Callback to save assistant response
    const saveAssistantMessage = async (text: string) => {
      await prisma.statuteChatMessage.create({
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
        const aiModel = createOpenAIModel(apiKey, model);
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
    console.error('Statute chat API error:', { error, provider, model });

    let errorMessage = 'Internal server error';

    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.includes('Unauthorized') || error.message.includes('invalid_api_key')) {
        errorMessage = 'Invalid API key. Please check your API key in settings.';
      } else if (error.message.includes('429') || error.message.includes('rate limit')) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (error.message.includes('model') || error.message.includes('does not exist') || error.message.includes('not found')) {
        errorMessage = `Model "${model}" not available for ${provider}. Error: ${error.message.replace(/sk-[a-zA-Z0-9]+/g, 'sk-***')}`;
      } else if (error.message.includes('insufficient_quota') || error.message.includes('quota')) {
        errorMessage = 'API quota exceeded. Please check your billing settings with your AI provider.';
      } else {
        errorMessage = `Error with ${provider}/${model}: ${error.message.replace(/sk-[a-zA-Z0-9]+/g, 'sk-***')}`;
      }
    }

    return new Response(errorMessage, { status: 500 });
  }
}
