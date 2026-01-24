/**
 * Sync Job Tests
 *
 * Tests for sync job lifecycle management and batch processing.
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { BillType, SyncJobStatus } from '@prisma/client';

// Mock dependencies
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    syncJob: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    bill: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    legislatureSession: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/admin/settings', () => ({
  getSetting: vi.fn(),
  getSettingTyped: vi.fn(),
}));

vi.mock('../ftp-client', () => ({
  fetchBillXml: vi.fn(),
  fetchBillTextFromUrl: vi.fn(),
  scanAvailableBills: vi.fn(),
  closeSharedClient: vi.fn(),
}));

vi.mock('../xml-parser', () => ({
  parseBillXml: vi.fn(),
}));

import { prisma } from '@/lib/db/prisma';
import { getSetting, getSettingTyped } from '@/lib/admin/settings';
import { fetchBillXml, fetchBillTextFromUrl, scanAvailableBills } from '../ftp-client';
import { parseBillXml } from '../xml-parser';
import {
  getActiveSyncJob,
  getSyncJob,
  createSyncJob,
  pauseSyncJob,
  resumeSyncJob,
  stopSyncJob,
  processSyncBatch,
  SyncJobState,
} from '../sync-job';

const mockSyncJob = {
  id: 'job-123',
  status: 'RUNNING' as SyncJobStatus,
  sessionCode: '89R',
  sessionName: '89th Regular Session',
  billTypes: ['HB', 'SB'],
  progressByType: { HB: 0, SB: 0 },
  completedTypes: {},
  totalProcessed: 0,
  totalCreated: 0,
  totalUpdated: 0,
  totalErrors: 0,
  startedAt: new Date('2025-01-01'),
  pausedAt: null,
  completedAt: null,
  lastActivityAt: new Date(),
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSession = {
  id: 'session-1',
  code: '89R',
  name: '89th Regular Session',
  startDate: new Date('2025-01-14'),
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Sync Job Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    (getSetting as Mock).mockResolvedValue('89R');
    (getSettingTyped as Mock).mockImplementation((key: string) => {
      if (key === 'BATCH_DELAY_MS') return Promise.resolve(500);
      if (key === 'MAX_BILLS_PER_SYNC') return Promise.resolve(100);
      return Promise.resolve(null);
    });
  });

  describe('getActiveSyncJob', () => {
    it('returns null when no active job exists', async () => {
      (prisma.syncJob.findFirst as Mock).mockResolvedValue(null);

      const result = await getActiveSyncJob();

      expect(result).toBeNull();
      expect(prisma.syncJob.findFirst).toHaveBeenCalledWith({
        where: {
          status: { in: ['PENDING', 'RUNNING', 'PAUSED'] },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns the active job when one exists', async () => {
      (prisma.syncJob.findFirst as Mock).mockResolvedValue(mockSyncJob);

      const result = await getActiveSyncJob();

      expect(result).not.toBeNull();
      expect(result!.id).toBe('job-123');
      expect(result!.status).toBe('RUNNING');
      expect(result!.sessionCode).toBe('89R');
    });

    it('maps all fields correctly', async () => {
      (prisma.syncJob.findFirst as Mock).mockResolvedValue(mockSyncJob);

      const result = await getActiveSyncJob();

      expect(result).toEqual({
        id: 'job-123',
        status: 'RUNNING',
        sessionCode: '89R',
        sessionName: '89th Regular Session',
        billTypes: ['HB', 'SB'],
        progressByType: { HB: 0, SB: 0 },
        completedTypes: {},
        totalProcessed: 0,
        totalCreated: 0,
        totalUpdated: 0,
        totalErrors: 0,
        startedAt: mockSyncJob.startedAt,
        pausedAt: null,
        completedAt: null,
        lastActivityAt: mockSyncJob.lastActivityAt,
        lastError: null,
      });
    });
  });

  describe('getSyncJob', () => {
    it('returns null when job does not exist', async () => {
      (prisma.syncJob.findUnique as Mock).mockResolvedValue(null);

      const result = await getSyncJob('nonexistent');

      expect(result).toBeNull();
      expect(prisma.syncJob.findUnique).toHaveBeenCalledWith({
        where: { id: 'nonexistent' },
      });
    });

    it('returns the job when it exists', async () => {
      (prisma.syncJob.findUnique as Mock).mockResolvedValue(mockSyncJob);

      const result = await getSyncJob('job-123');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('job-123');
    });
  });

  describe('createSyncJob', () => {
    it('creates a new job with default settings', async () => {
      (prisma.syncJob.findFirst as Mock).mockResolvedValue(null);
      (prisma.bill.findFirst as Mock).mockResolvedValue(null);
      (prisma.syncJob.create as Mock).mockResolvedValue(mockSyncJob);

      const result = await createSyncJob();

      expect(result.status).toBe('RUNNING');
      expect(result.billTypes).toEqual(['HB', 'SB']);
      expect(prisma.syncJob.create).toHaveBeenCalled();
    });

    it('throws error when active job already exists', async () => {
      (prisma.syncJob.findFirst as Mock).mockResolvedValue(mockSyncJob);

      await expect(createSyncJob()).rejects.toThrow('A sync job is already active');
    });

    it('uses settings from database', async () => {
      (prisma.syncJob.findFirst as Mock).mockResolvedValue(null);
      (prisma.bill.findFirst as Mock).mockResolvedValue(null);
      (getSetting as Mock).mockImplementation((key: string) => {
        if (key === 'SESSION_CODE') return Promise.resolve('90R');
        if (key === 'SESSION_NAME') return Promise.resolve('90th Session');
        return Promise.resolve(null);
      });
      (prisma.syncJob.create as Mock).mockResolvedValue({
        ...mockSyncJob,
        sessionCode: '90R',
        sessionName: '90th Session',
      });

      const result = await createSyncJob();

      expect(prisma.syncJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionCode: '90R',
          sessionName: '90th Session',
        }),
      });
    });

    it('resumes from last synced bill number', async () => {
      (prisma.syncJob.findFirst as Mock).mockResolvedValue(null);
      (prisma.bill.findFirst as Mock)
        .mockResolvedValueOnce({ billNumber: 150 }) // HB
        .mockResolvedValueOnce({ billNumber: 75 }); // SB
      (prisma.syncJob.create as Mock).mockResolvedValue({
        ...mockSyncJob,
        progressByType: { HB: 150, SB: 75 },
      });

      const result = await createSyncJob();

      expect(prisma.syncJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          progressByType: { HB: 150, SB: 75 },
        }),
      });
    });
  });

  describe('pauseSyncJob', () => {
    it('updates job status to PAUSED', async () => {
      (prisma.syncJob.update as Mock).mockResolvedValue({
        ...mockSyncJob,
        status: 'PAUSED',
        pausedAt: new Date(),
      });
      (prisma.syncJob.findUnique as Mock).mockResolvedValue({
        ...mockSyncJob,
        status: 'PAUSED',
        pausedAt: new Date(),
      });

      const result = await pauseSyncJob('job-123');

      expect(result.status).toBe('PAUSED');
      expect(prisma.syncJob.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: {
          status: 'PAUSED',
          pausedAt: expect.any(Date),
        },
      });
    });
  });

  describe('resumeSyncJob', () => {
    it('updates job status to RUNNING and clears pausedAt', async () => {
      (prisma.syncJob.update as Mock).mockResolvedValue({
        ...mockSyncJob,
        status: 'RUNNING',
        pausedAt: null,
      });
      (prisma.syncJob.findUnique as Mock).mockResolvedValue({
        ...mockSyncJob,
        status: 'RUNNING',
        pausedAt: null,
      });

      const result = await resumeSyncJob('job-123');

      expect(result.status).toBe('RUNNING');
      expect(prisma.syncJob.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: {
          status: 'RUNNING',
          pausedAt: null,
        },
      });
    });
  });

  describe('stopSyncJob', () => {
    it('updates job status to STOPPED with completedAt', async () => {
      (prisma.syncJob.update as Mock).mockResolvedValue({
        ...mockSyncJob,
        status: 'STOPPED',
        completedAt: new Date(),
      });
      (prisma.syncJob.findUnique as Mock).mockResolvedValue({
        ...mockSyncJob,
        status: 'STOPPED',
        completedAt: new Date(),
      });

      const result = await stopSyncJob('job-123');

      expect(result.status).toBe('STOPPED');
      expect(prisma.syncJob.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: {
          status: 'STOPPED',
          completedAt: expect.any(Date),
        },
      });
    });
  });
});

describe('processSyncBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSettingTyped as Mock).mockResolvedValue(500);
  });

  it('throws error when job not found', async () => {
    (prisma.syncJob.findUnique as Mock).mockResolvedValue(null);

    await expect(processSyncBatch('nonexistent')).rejects.toThrow('Sync job not found');
  });

  it('returns early when job is not RUNNING', async () => {
    (prisma.syncJob.findUnique as Mock).mockResolvedValue({
      ...mockSyncJob,
      status: 'PAUSED',
    });

    const result = await processSyncBatch('job-123');

    expect(result.processed).toBe(0);
    expect(result.message).toBe('Job is paused');
    expect(result.isComplete).toBe(false);
  });

  it('returns isComplete true for COMPLETED jobs', async () => {
    (prisma.syncJob.findUnique as Mock).mockResolvedValue({
      ...mockSyncJob,
      status: 'COMPLETED',
    });

    const result = await processSyncBatch('job-123');

    expect(result.isComplete).toBe(true);
  });

  it('processes bills from FTP when job is RUNNING', async () => {
    (prisma.syncJob.findUnique as Mock)
      .mockResolvedValueOnce(mockSyncJob)
      .mockResolvedValueOnce(mockSyncJob)
      .mockResolvedValueOnce(mockSyncJob);
    (prisma.legislatureSession.upsert as Mock).mockResolvedValue(mockSession);
    (scanAvailableBills as Mock).mockResolvedValue([1, 2, 3]);
    (fetchBillXml as Mock).mockResolvedValue({ xml: '<billhistory bill="89(R) HB 1"><caption>Test</caption><authors>Test</authors></billhistory>', notFound: false, error: false });
    (parseBillXml as Mock).mockReturnValue({
      billId: 'HB 1',
      billType: 'HB',
      billNumber: 1,
      description: 'Test bill',
      authors: ['Test'],
      coauthors: [],
      sponsors: [],
      cosponsors: [],
      subjects: [],
      status: 'Filed',
      lastAction: '',
      lastActionDate: null,
      lastUpdate: null,
      textUrl: null,
      committees: [],
      actions: [],
    });
    (fetchBillTextFromUrl as Mock).mockResolvedValue(null);
    (prisma.bill.findUnique as Mock).mockResolvedValue(null);
    (prisma.bill.create as Mock).mockResolvedValue({ id: 'bill-1' });
    (prisma.syncJob.update as Mock).mockResolvedValue(mockSyncJob);

    const result = await processSyncBatch('job-123');

    expect(result.processed).toBeGreaterThan(0);
    expect(scanAvailableBills).toHaveBeenCalledWith('89R', 'HB');
  });

  it('marks bill type as completed when no more bills', async () => {
    const jobWithProgress = {
      ...mockSyncJob,
      progressByType: { HB: 100, SB: 0 },
      completedTypes: {},
    };
    (prisma.syncJob.findUnique as Mock).mockResolvedValue(jobWithProgress);
    (prisma.legislatureSession.upsert as Mock).mockResolvedValue(mockSession);
    (scanAvailableBills as Mock).mockResolvedValue([1, 2, 3]); // All less than 100
    (prisma.syncJob.update as Mock).mockResolvedValue({
      ...jobWithProgress,
      completedTypes: { HB: true },
    });

    const result = await processSyncBatch('job-123');

    expect(prisma.syncJob.update).toHaveBeenCalledWith({
      where: { id: 'job-123' },
      data: expect.objectContaining({
        completedTypes: { HB: true },
      }),
    });
  });

  it('marks job as COMPLETED when all bill types exhausted', async () => {
    const jobNearComplete = {
      ...mockSyncJob,
      billTypes: ['HB'],
      progressByType: { HB: 100 },
      completedTypes: {},
    };
    (prisma.syncJob.findUnique as Mock).mockResolvedValue(jobNearComplete);
    (prisma.legislatureSession.upsert as Mock).mockResolvedValue(mockSession);
    (scanAvailableBills as Mock).mockResolvedValue([1, 2, 3]); // All less than 100

    const result = await processSyncBatch('job-123');

    expect(prisma.syncJob.update).toHaveBeenCalledWith({
      where: { id: 'job-123' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        completedAt: expect.any(Date),
      }),
    });
  });

  it('handles FTP fetch errors gracefully', async () => {
    (prisma.syncJob.findUnique as Mock)
      .mockResolvedValueOnce(mockSyncJob)
      .mockResolvedValueOnce(mockSyncJob)
      .mockResolvedValueOnce(mockSyncJob);
    (prisma.legislatureSession.upsert as Mock).mockResolvedValue(mockSession);
    (scanAvailableBills as Mock).mockResolvedValue([1]);
    (fetchBillXml as Mock).mockResolvedValue({ xml: null, notFound: false, error: true });
    (prisma.syncJob.update as Mock).mockResolvedValue(mockSyncJob);

    const result = await processSyncBatch('job-123');

    expect(result.errors).toBe(1);
    // When FTP fails, no bill data is returned, so billsProcessed may be empty
    // The error is counted in errors field
  });

  it('updates an existing bill instead of creating', async () => {
    (prisma.syncJob.findUnique as Mock)
      .mockResolvedValueOnce(mockSyncJob)
      .mockResolvedValueOnce(mockSyncJob)
      .mockResolvedValueOnce(mockSyncJob);
    (prisma.legislatureSession.upsert as Mock).mockResolvedValue(mockSession);
    (scanAvailableBills as Mock).mockResolvedValue([1]);
    (fetchBillXml as Mock).mockResolvedValue({ xml: '<billhistory bill="89(R) HB 1"><caption>Test</caption><authors>Test</authors></billhistory>', notFound: false, error: false });
    (parseBillXml as Mock).mockReturnValue({
      billId: 'HB 1',
      billType: 'HB',
      billNumber: 1,
      description: 'Test bill',
      authors: ['Test'],
      coauthors: [],
      sponsors: [],
      cosponsors: [],
      subjects: [],
      status: 'Filed',
      lastAction: '',
      lastActionDate: null,
      lastUpdate: null,
      textUrl: null,
      committees: [],
      actions: [],
    });
    (fetchBillTextFromUrl as Mock).mockResolvedValue(null);
    (prisma.bill.findUnique as Mock).mockResolvedValue({ id: 'existing-bill' });
    (prisma.bill.update as Mock).mockResolvedValue({ id: 'existing-bill' });
    (prisma.syncJob.update as Mock).mockResolvedValue(mockSyncJob);

    const result = await processSyncBatch('job-123');

    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);
    expect(prisma.bill.update).toHaveBeenCalled();
    expect(prisma.bill.create).not.toHaveBeenCalled();
  });

  it('respects job pause during batch processing', async () => {
    // First call gets initial job state (RUNNING)
    // Subsequent calls return PAUSED to stop processing
    (prisma.syncJob.findUnique as Mock)
      .mockResolvedValueOnce(mockSyncJob) // Initial check - RUNNING
      .mockResolvedValueOnce({ ...mockSyncJob, status: 'PAUSED' }) // Check during first bill
      .mockResolvedValueOnce({ ...mockSyncJob, status: 'PAUSED' }); // For update check
    (prisma.legislatureSession.upsert as Mock).mockResolvedValue(mockSession);
    (scanAvailableBills as Mock).mockResolvedValue([1, 2, 3, 4, 5]);
    (fetchBillXml as Mock).mockResolvedValue({ xml: '<billhistory bill="89(R) HB 1"><caption>Test</caption><authors>Test</authors></billhistory>', notFound: false, error: false });
    (parseBillXml as Mock).mockReturnValue({
      billId: 'HB 1',
      billType: 'HB',
      billNumber: 1,
      description: 'Test bill',
      authors: ['Test'],
      coauthors: [],
      sponsors: [],
      cosponsors: [],
      subjects: [],
      status: 'Filed',
      lastAction: '',
      lastActionDate: null,
      lastUpdate: null,
      textUrl: null,
      committees: [],
      actions: [],
    });
    (fetchBillTextFromUrl as Mock).mockResolvedValue(null);
    (prisma.bill.findUnique as Mock).mockResolvedValue(null);
    (prisma.bill.create as Mock).mockResolvedValue({ id: 'bill-1' });
    (prisma.syncJob.update as Mock).mockResolvedValue(mockSyncJob);

    const result = await processSyncBatch('job-123');

    // Should stop after detecting PAUSED status - may process 0 or 1 bills
    // depending on when the check happens
    expect(result.processed).toBeLessThanOrEqual(1);
  });
});
