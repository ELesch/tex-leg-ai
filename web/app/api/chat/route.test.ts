import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { prisma } from '@/lib/db/prisma';
import { auth } from '@/lib/auth';

// Mock the AI SDK
vi.mock('ai', () => ({
  streamText: vi.fn(() => ({
    toDataStreamResponse: () => new Response('Mocked AI response', { status: 200 }),
  })),
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => ({})),
}));

// Mock NextRequest
function createMockRequest(body: object): Request {
  return new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('returns 401 if user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null);

      const request = createMockRequest({
        messages: [{ role: 'user', content: 'Hello' }],
        billId: 'HB 123',
      });

      const response = await POST(request as any);
      expect(response.status).toBe(401);
      const text = await response.text();
      expect(text).toBe('Unauthorized');
    });

    it('returns 401 if session has no user id', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { email: 'test@example.com' },
        expires: new Date().toISOString(),
      } as any);

      const request = createMockRequest({
        messages: [{ role: 'user', content: 'Hello' }],
        billId: 'HB 123',
      });

      const response = await POST(request as any);
      expect(response.status).toBe(401);
    });
  });

  describe('validation', () => {
    it('returns 400 if billId is missing', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'test@example.com' },
        expires: new Date().toISOString(),
      });

      const request = createMockRequest({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      const response = await POST(request as any);
      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).toBe('Bill ID required');
    });

    it('returns 404 if bill not found', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'test@example.com' },
        expires: new Date().toISOString(),
      });

      vi.mocked(prisma.bill.findUnique).mockResolvedValueOnce(null);

      const request = createMockRequest({
        messages: [{ role: 'user', content: 'Hello' }],
        billId: 'HB 999',
      });

      const response = await POST(request as any);
      expect(response.status).toBe(404);
      const text = await response.text();
      expect(text).toBe('Bill not found');
    });
  });

  describe('chat session management', () => {
    const mockBill = {
      id: 'bill-1',
      billId: 'HB 123',
      description: 'Education funding bill',
      content: 'Full bill text content here...',
      status: 'Filed',
      authors: ['Rep. Smith', 'Rep. Jones'],
      lastAction: 'Referred to committee',
    };

    const mockChatSession = {
      id: 'session-1',
      userId: 'user-123',
      billId: 'bill-1',
      title: 'Chat about HB 123',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'test@example.com' },
        expires: new Date().toISOString(),
      });

      vi.mocked(prisma.bill.findUnique).mockResolvedValueOnce(mockBill as any);
      vi.mocked(prisma.chatSession.upsert).mockResolvedValueOnce(mockChatSession as any);
      vi.mocked(prisma.chatMessage.create).mockResolvedValueOnce({} as any);
    });

    it('creates or updates chat session', async () => {
      const request = createMockRequest({
        messages: [{ role: 'user', content: 'What is this bill about?' }],
        billId: 'HB 123',
      });

      await POST(request as any);

      expect(prisma.chatSession.upsert).toHaveBeenCalledWith({
        where: {
          userId_billId: {
            userId: 'user-123',
            billId: 'bill-1',
          },
        },
        create: {
          userId: 'user-123',
          billId: 'bill-1',
          title: 'Chat about HB 123',
        },
        update: {
          updatedAt: expect.any(Date),
        },
      });
    });

    it('saves user message to database', async () => {
      const request = createMockRequest({
        messages: [{ role: 'user', content: 'What is this bill about?' }],
        billId: 'HB 123',
      });

      await POST(request as any);

      expect(prisma.chatMessage.create).toHaveBeenCalledWith({
        data: {
          chatSessionId: 'session-1',
          role: 'USER',
          content: 'What is this bill about?',
        },
      });
    });

    it('returns streaming response', async () => {
      const request = createMockRequest({
        messages: [{ role: 'user', content: 'What is this bill about?' }],
        billId: 'HB 123',
      });

      const response = await POST(request as any);

      expect(response.status).toBe(200);
    });
  });

  describe('error handling', () => {
    it('returns 500 on database error', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'test@example.com' },
        expires: new Date().toISOString(),
      });

      vi.mocked(prisma.bill.findUnique).mockRejectedValueOnce(new Error('Database error'));

      const request = createMockRequest({
        messages: [{ role: 'user', content: 'Hello' }],
        billId: 'HB 123',
      });

      const response = await POST(request as any);
      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toBe('Internal server error');
    });
  });
});
