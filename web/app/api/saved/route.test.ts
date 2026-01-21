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
  return new Request('http://localhost:3000/api/saved', init);
}

describe('/api/saved', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/saved', () => {
    it('returns 401 if user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns saved bills for authenticated user', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'test@example.com' },
        expires: new Date().toISOString(),
      });

      const mockSavedBills = [
        {
          id: 'saved-1',
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

      vi.mocked(prisma.savedBill.findMany).mockResolvedValueOnce(mockSavedBills);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.savedBills).toHaveLength(1);
      expect(data.savedBills[0].bill.billId).toBe('HB 123');
    });

    it('returns empty array when no saved bills', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'test@example.com' },
        expires: new Date().toISOString(),
      });

      vi.mocked(prisma.savedBill.findMany).mockResolvedValueOnce([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.savedBills).toEqual([]);
    });
  });

  describe('POST /api/saved', () => {
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

    it('returns 409 if bill already saved', async () => {
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

      vi.mocked(prisma.savedBill.findUnique).mockResolvedValueOnce({
        id: 'saved-1',
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
      expect(data.error).toBe('Bill already saved');
    });

    it('saves bill successfully', async () => {
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

      vi.mocked(prisma.savedBill.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prisma.savedBill.create).mockResolvedValueOnce({
        id: 'saved-1',
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
      expect(data.savedBill).toBeDefined();
    });
  });

  describe('DELETE /api/saved', () => {
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

    it('deletes saved bill successfully', async () => {
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

      vi.mocked(prisma.savedBill.delete).mockResolvedValueOnce({
        id: 'saved-1',
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
