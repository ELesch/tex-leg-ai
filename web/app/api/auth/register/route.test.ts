import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth';

// Mock NextRequest
function createMockRequest(body: object): Request {
  return new Request('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validation', () => {
    it('returns 400 if name is missing', async () => {
      const request = createMockRequest({
        email: 'test@example.com',
        password: 'password123',
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      // Zod returns 'Required' for missing fields, our custom message is for min length
      expect(data.error).toBeDefined();
    });

    it('returns 400 if email is invalid', async () => {
      const request = createMockRequest({
        name: 'Test User',
        email: 'invalid-email',
        password: 'password123',
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid email address');
    });

    it('returns 400 if password is too short', async () => {
      const request = createMockRequest({
        name: 'Test User',
        email: 'test@example.com',
        password: 'short',
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Password must be at least 8 characters');
    });

    it('returns 400 if email is missing', async () => {
      const request = createMockRequest({
        name: 'Test User',
        password: 'password123',
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
    });
  });

  describe('user creation', () => {
    it('returns 409 if user already exists', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'existing-user-id',
        email: 'test@example.com',
        name: 'Existing User',
        passwordHash: 'hash',
        image: null,
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      });

      const request = createMockRequest({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('An account with this email already exists');
    });

    it('creates user successfully with valid data', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.user.create).mockResolvedValueOnce({
        id: 'new-user-id',
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: 'hashed_password123',
        image: null,
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      });

      const request = createMockRequest({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toBe('Account created successfully');
      expect(data.user).toHaveProperty('id');
      expect(data.user.email).toBe('test@example.com');
    });

    it('hashes password before storing', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.user.create).mockResolvedValueOnce({
        id: 'new-user-id',
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: 'hashed_password123',
        image: null,
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      });

      const request = createMockRequest({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      await POST(request as any);

      expect(hashPassword).toHaveBeenCalledWith('password123');
    });
  });

  describe('error handling', () => {
    it('returns 500 on database error', async () => {
      vi.mocked(prisma.user.findUnique).mockRejectedValueOnce(new Error('Database error'));

      const request = createMockRequest({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
