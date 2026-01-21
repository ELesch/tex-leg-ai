import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn((key: string) => null),
    toString: () => '',
  }),
  usePathname: () => '/',
}));

// Mock next-auth
vi.mock('next-auth', () => ({
  default: vi.fn(),
}));

// Mock @/lib/auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() => Promise.resolve(null)),
  hashPassword: vi.fn((password: string) => Promise.resolve(`hashed_${password}`)),
  verifyPassword: vi.fn((password: string, hash: string) => Promise.resolve(true)),
}));

// Mock @/lib/db/prisma
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    bill: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    savedBill: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    chatSession: {
      upsert: vi.fn(),
    },
    chatMessage: {
      create: vi.fn(),
    },
  },
}));

// Global test setup
beforeEach(() => {
  vi.clearAllMocks();
});
