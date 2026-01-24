import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST, DELETE } from './route';
import { prisma } from '@/lib/db/prisma';
import { auth } from '@/lib/auth';

// Mock NextRequest
function createMockRequest(body?: object, method: string = 'POST'): Request {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new Request('http://localhost:3000/api/followed', init);
}

describe('/api/followed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/followed', () => {
    it('returns 401 if user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns followed bills for authenticated user', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'test@example.com' },
        expires: new Date().toISOString(),
      });

      const mockFollowedBills = [
        {
          id: 'followed-1',
          userId: 'user-123',
          billId: 'bill-1',
          notes: 'Important bill',
          tags: ['education'],
          createdAt: new Date(),
          updatedAt: new Date(),
          bill: {
            id: 'bill-1',
            billId: 'HB 123',
            billType: 'HB',
            billNumber: 123,
            description: 'Education bill',
            status: 'Filed',
            lastAction: null,
            lastActionDate: null,
          },
        },
      ];

      vi.mocked(prisma.followedBill.findMany).mockResolvedValueOnce(mockFollowedBills);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.followedBills).toHaveLength(1);
      expect(data.followedBills[0].bill.billId).toBe('HB 123');
    });

    it('returns empty array when no followed bills', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'test@example.com' },
        expires: new Date().toISOString(),
      });

      vi.mocked(prisma.followedBill.findMany).mockResolvedValueOnce([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.followedBills).toEqual([]);
    });
  });

  describe('POST /api/followed', () => {
    it('returns 401 if user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null);

      const request = createMockRequest({ billId: 'HB 123' });
      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 if billId is missing', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'test@example.com' },
        expires: new Date().toISOString(),
      });

      const request = createMockRequest({});
      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Bill ID required');
    });

    it('returns 404 if bill not found', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'test@example.com' },
        expires: new Date().toISOString(),
      });

      vi.mocked(prisma.bill.findUnique).mockResolvedValueOnce(null);

      const request = createMockRequest({ billId: 'HB 999' });
      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Bill not found');
    });

    it('returns 409 if bill already followed', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'test@example.com' },
        expires: new Date().toISOString(),
      });

      vi.mocked(prisma.bill.findUnique).mockResolvedValueOnce({
        id: 'bill-1',
        billId: 'HB 123',
        billType: 'HB',
        billNumber: 123,
        filename: 'hb123.txt',
        sessionId: 'session-1',
        description: 'Test bill',
        content: null,
        contentPath: null,
        status: 'Filed',
        authors: [],
        subjects: [],
        lastAction: null,
        lastActionDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.followedBill.findUnique).mockResolvedValueOnce({
        id: 'followed-1',
        userId: 'user-123',
        billId: 'bill-1',
        notes: null,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = createMockRequest({ billId: 'HB 123' });
      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Bill already followed');
    });

    it('follows bill successfully', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'test@example.com' },
        expires: new Date().toISOString(),
      });

      vi.mocked(prisma.bill.findUnique).mockResolvedValueOnce({
        id: 'bill-1',
        billId: 'HB 123',
        billType: 'HB',
        billNumber: 123,
        filename: 'hb123.txt',
        sessionId: 'session-1',
        description: 'Test bill',
        content: null,
        contentPath: null,
        status: 'Filed',
        authors: [],
        subjects: [],
        lastAction: null,
        lastActionDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.followedBill.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prisma.followedBill.create).mockResolvedValueOnce({
        id: 'followed-1',
        userId: 'user-123',
        billId: 'bill-1',
        notes: 'My notes',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        bill: {
          billId: 'HB 123',
          description: 'Test bill',
        },
      } as any);

      const request = createMockRequest({ billId: 'HB 123', notes: 'My notes' });
      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.followedBill).toBeDefined();
    });
  });

  describe('DELETE /api/followed', () => {
    it('returns 401 if user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null);

      const request = createMockRequest({ billId: 'HB 123' }, 'DELETE');
      const response = await DELETE(request as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 if billId is missing', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'test@example.com' },
        expires: new Date().toISOString(),
      });

      const request = createMockRequest({}, 'DELETE');
      const response = await DELETE(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Bill ID required');
    });

    it('returns 404 if bill not found', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'test@example.com' },
        expires: new Date().toISOString(),
      });

      vi.mocked(prisma.bill.findUnique).mockResolvedValueOnce(null);

      const request = createMockRequest({ billId: 'HB 999' }, 'DELETE');
      const response = await DELETE(request as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Bill not found');
    });

    it('unfollows bill successfully', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'test@example.com' },
        expires: new Date().toISOString(),
      });

      vi.mocked(prisma.bill.findUnique).mockResolvedValueOnce({
        id: 'bill-1',
        billId: 'HB 123',
        billType: 'HB',
        billNumber: 123,
        filename: 'hb123.txt',
        sessionId: 'session-1',
        description: 'Test bill',
        content: null,
        contentPath: null,
        status: 'Filed',
        authors: [],
        subjects: [],
        lastAction: null,
        lastActionDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.followedBill.delete).mockResolvedValueOnce({
        id: 'followed-1',
        userId: 'user-123',
        billId: 'bill-1',
        notes: null,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = createMockRequest({ billId: 'HB 123' }, 'DELETE');
      const response = await DELETE(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
