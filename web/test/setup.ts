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

// Mock @/lib/logger
const mockLoggerMethods = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(() => mockLoggerMethods),
};

vi.mock('@/lib/logger', () => ({
  logger: mockLoggerMethods,
  createRequestLogger: vi.fn(() => mockLoggerMethods),
  logAuthEvent: vi.fn(),
  maskEmail: vi.fn((email: string) => `***@${email.split('@')[1] || '***'}`),
  generateRequestId: vi.fn(() => 'req_test_123'),
  getClientIp: vi.fn(() => '127.0.0.1'),
  REQUEST_ID_HEADER: 'x-request-id',
  addLog: vi.fn(),
  getLogs: vi.fn(() => []),
  clearLogs: vi.fn(),
  getLogStats: vi.fn(() => ({ total: 0, byLevel: {} })),
}));

// Mock @/lib/db/prisma
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    bill: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    followedBill: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    chatSession: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    chatMessage: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    personalNote: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    author: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    team: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    teamMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    annotation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    invitation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    // Sync-related models
    syncJob: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    legislatureSession: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    adminSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Global test setup
beforeEach(() => {
  vi.clearAllMocks();
});
