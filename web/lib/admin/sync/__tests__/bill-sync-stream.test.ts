/**
 * Bill Sync Stream Tests
 *
 * Tests for the streaming sync functionality with progress callbacks.
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { BillType } from '@prisma/client';

// Mock dependencies
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
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
}));

vi.mock('../xml-parser', () => ({
  parseBillXml: vi.fn(),
}));

import { prisma } from '@/lib/db/prisma';
import { getSetting, getSettingTyped } from '@/lib/admin/settings';
import { fetchBillXml, fetchBillTextFromUrl, scanAvailableBills } from '../ftp-client';
import { parseBillXml } from '../xml-parser';
import {
  syncBillsWithProgress,
  SyncOptions,
  SyncEvent,
  SyncPhaseEvent,
  SyncProgressEvent,
  SyncBillEvent,
  SyncCompleteEvent,
  SyncErrorEvent,
  SyncLogEvent,
} from '../bill-sync-stream';

const mockSession = {
  id: 'session-1',
  code: '89R',
  name: '89th Regular Session',
  startDate: new Date('2025-01-14'),
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockParsedBill = {
  billId: 'HB 1',
  billType: 'HB' as BillType,
  billNumber: 1,
  description: 'Test bill description',
  authors: ['Author1', 'Author2'],
  coauthors: ['Coauthor1'],
  sponsors: [],
  cosponsors: [],
  subjects: ['Education'],
  status: 'In Committee',
  lastAction: '01/15/2025 H Referred to Education',
  lastActionDate: new Date('2025-01-15'),
  lastUpdate: new Date('2025-01-20'),
  textUrl: 'http://capitol.texas.gov/bill.htm',
  committees: [{ chamber: 'house' as const, name: 'Education', status: 'In committee' }],
  actions: [{ date: '1/10/2025', description: 'Filed' }],
};

describe('Bill Sync Stream', () => {
  let events: SyncEvent[];
  let eventCallback: (type: string, data: unknown) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    events = [];
    eventCallback = (type: string, data: unknown) => {
      events.push({ type, data } as SyncEvent);
    };

    // Default mock implementations
    (getSetting as Mock).mockImplementation((key: string) => {
      if (key === 'SESSION_CODE') return Promise.resolve('89R');
      if (key === 'SESSION_NAME') return Promise.resolve('89th Regular Session');
      return Promise.resolve(null);
    });
    (getSettingTyped as Mock).mockImplementation((key: string) => {
      if (key === 'MAX_BILLS_PER_SYNC') return Promise.resolve(100);
      if (key === 'BATCH_DELAY_MS') return Promise.resolve(10); // Fast for tests
      if (key === 'SYNC_ENABLED') return Promise.resolve(true);
      return Promise.resolve(null);
    });
    (prisma.legislatureSession.upsert as Mock).mockResolvedValue(mockSession);
    (prisma.bill.findFirst as Mock).mockResolvedValue(null);
    (prisma.bill.findUnique as Mock).mockResolvedValue(null);
    (prisma.bill.create as Mock).mockResolvedValue({ id: 'bill-1' });
    (prisma.bill.update as Mock).mockResolvedValue({ id: 'bill-1' });
  });

  describe('syncBillsWithProgress', () => {
    describe('initialization', () => {
      it('emits error when sync is disabled', async () => {
        (getSettingTyped as Mock).mockImplementation((key: string) => {
          if (key === 'SYNC_ENABLED') return Promise.resolve(false);
          return Promise.resolve(null);
        });

        await syncBillsWithProgress({}, eventCallback);

        const errorEvent = events.find(e => e.type === 'error') as { type: 'error'; data: SyncErrorEvent };
        expect(errorEvent).toBeDefined();
        expect(errorEvent.data.message).toBe('Sync is disabled');
      });

      it('emits initializing phase at start', async () => {
        (scanAvailableBills as Mock).mockResolvedValue([]);

        await syncBillsWithProgress({}, eventCallback);

        const phaseEvents = events.filter(e => e.type === 'phase') as Array<{ type: 'phase'; data: SyncPhaseEvent }>;
        expect(phaseEvents[0]?.data.phase).toBe('initializing');
      });

      it('uses provided options over database settings', async () => {
        (scanAvailableBills as Mock).mockResolvedValue([]);

        await syncBillsWithProgress({
          sessionCode: '90R',
          sessionName: '90th Session',
          maxBills: 50,
          batchDelay: 100,
          billTypes: ['SB'],
        }, eventCallback);

        expect(prisma.legislatureSession.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { code: '90R' },
            create: expect.objectContaining({
              code: '90R',
              name: '90th Session',
            }),
          })
        );
      });
    });

    describe('FTP scanning', () => {
      it('emits scanning_ftp phase', async () => {
        (scanAvailableBills as Mock).mockResolvedValue([]);

        await syncBillsWithProgress({}, eventCallback);

        const scanningEvent = events.find(e =>
          e.type === 'phase' && (e.data as SyncPhaseEvent).phase === 'scanning_ftp'
        );
        expect(scanningEvent).toBeDefined();
      });

      it('scans for each bill type', async () => {
        (scanAvailableBills as Mock).mockResolvedValue([]);

        await syncBillsWithProgress({ billTypes: ['HB', 'SB'] as BillType[] }, eventCallback);

        expect(scanAvailableBills).toHaveBeenCalledWith('89R', 'HB');
        expect(scanAvailableBills).toHaveBeenCalledWith('89R', 'SB');
      });

      it('logs available bill counts', async () => {
        (scanAvailableBills as Mock)
          .mockResolvedValueOnce([1, 2, 3, 4, 5])
          .mockResolvedValueOnce([1, 2, 3]);

        await syncBillsWithProgress({ billTypes: ['HB', 'SB'] as BillType[] }, eventCallback);

        const logEvents = events.filter(e => e.type === 'log') as Array<{ type: 'log'; data: SyncLogEvent }>;
        const foundLogHB = logEvents.find(e => e.data.message.includes('Found 5 HB bills'));
        const foundLogSB = logEvents.find(e => e.data.message.includes('Found 3 SB bills'));
        expect(foundLogHB).toBeDefined();
        expect(foundLogSB).toBeDefined();
      });
    });

    describe('bill processing', () => {
      it('emits processing_bills phase', async () => {
        (scanAvailableBills as Mock).mockResolvedValue([1]);
        (fetchBillXml as Mock).mockResolvedValue('<xml>test</xml>');
        (parseBillXml as Mock).mockReturnValue(mockParsedBill);
        (fetchBillTextFromUrl as Mock).mockResolvedValue('Bill text content');

        await syncBillsWithProgress({ maxBills: 1 }, eventCallback);

        const processingEvent = events.find(e =>
          e.type === 'phase' && (e.data as SyncPhaseEvent).phase === 'processing_bills'
        );
        expect(processingEvent).toBeDefined();
      });

      it('emits progress events during processing', async () => {
        (scanAvailableBills as Mock).mockResolvedValue([1, 2, 3]);
        (fetchBillXml as Mock).mockResolvedValue('<xml>test</xml>');
        (parseBillXml as Mock).mockReturnValue(mockParsedBill);
        (fetchBillTextFromUrl as Mock).mockResolvedValue('Bill text content');

        await syncBillsWithProgress({ maxBills: 3, syncUntilComplete: false }, eventCallback);

        const progressEvents = events.filter(e => e.type === 'progress') as Array<{ type: 'progress'; data: SyncProgressEvent }>;
        expect(progressEvents.length).toBeGreaterThan(0);
        expect(progressEvents[0].data.current).toBe(1);
        expect(progressEvents[0].data.total).toBe(3);
      });

      it('emits bill event for each processed bill', async () => {
        (scanAvailableBills as Mock).mockResolvedValue([1]);
        (fetchBillXml as Mock).mockResolvedValue('<xml>test</xml>');
        (parseBillXml as Mock).mockReturnValue(mockParsedBill);
        (fetchBillTextFromUrl as Mock).mockResolvedValue('Bill text content');

        await syncBillsWithProgress({ maxBills: 1, billTypes: ['HB'] as BillType[], syncUntilComplete: false }, eventCallback);

        const billEvents = events.filter(e => e.type === 'bill') as Array<{ type: 'bill'; data: SyncBillEvent }>;
        expect(billEvents.length).toBeGreaterThanOrEqual(1);
        expect(billEvents[0].data.billId).toBe('HB 1');
        expect(billEvents[0].data.status).toBe('created');
      });

      it('creates new bills in database', async () => {
        (scanAvailableBills as Mock).mockResolvedValue([1]);
        (fetchBillXml as Mock).mockResolvedValue('<xml>test</xml>');
        (parseBillXml as Mock).mockReturnValue(mockParsedBill);
        (fetchBillTextFromUrl as Mock).mockResolvedValue('Bill text content');
        (prisma.bill.findUnique as Mock).mockResolvedValue(null);

        await syncBillsWithProgress({ maxBills: 1 }, eventCallback);

        expect(prisma.bill.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            billId: 'HB 1',
            billType: 'HB',
            billNumber: 1,
            description: 'Test bill description',
            content: 'Bill text content',
          }),
        });
      });

      it('updates existing bills in database', async () => {
        (scanAvailableBills as Mock).mockResolvedValue([1]);
        (fetchBillXml as Mock).mockResolvedValue('<xml>test</xml>');
        (parseBillXml as Mock).mockReturnValue(mockParsedBill);
        (fetchBillTextFromUrl as Mock).mockResolvedValue('Bill text content');
        (prisma.bill.findUnique as Mock).mockResolvedValue({ id: 'existing-bill' });

        await syncBillsWithProgress({ maxBills: 1 }, eventCallback);

        expect(prisma.bill.update).toHaveBeenCalledWith({
          where: { billId: 'HB 1' },
          data: expect.objectContaining({
            description: 'Test bill description',
          }),
        });

        const billEvents = events.filter(e => e.type === 'bill') as Array<{ type: 'bill'; data: SyncBillEvent }>;
        expect(billEvents[0].data.status).toBe('updated');
      });

      it('handles FTP fetch failures gracefully', async () => {
        (scanAvailableBills as Mock).mockResolvedValue([1]);
        (fetchBillXml as Mock).mockResolvedValue(null);

        await syncBillsWithProgress({ maxBills: 1 }, eventCallback);

        const billEvents = events.filter(e => e.type === 'bill') as Array<{ type: 'bill'; data: SyncBillEvent }>;
        expect(billEvents[0].data.status).toBe('error');
        expect(billEvents[0].data.message).toContain('Failed to fetch');
      });

      it('handles XML parse failures gracefully', async () => {
        (scanAvailableBills as Mock).mockResolvedValue([1]);
        (fetchBillXml as Mock).mockResolvedValue('<xml>invalid</xml>');
        (parseBillXml as Mock).mockReturnValue(null);

        await syncBillsWithProgress({ maxBills: 1 }, eventCallback);

        const billEvents = events.filter(e => e.type === 'bill') as Array<{ type: 'bill'; data: SyncBillEvent }>;
        expect(billEvents[0].data.status).toBe('error');
      });
    });

    describe('completion', () => {
      it('emits complete phase at end', async () => {
        (scanAvailableBills as Mock).mockResolvedValue([]);

        await syncBillsWithProgress({}, eventCallback);

        const completePhase = events.find(e =>
          e.type === 'phase' && (e.data as SyncPhaseEvent).phase === 'complete'
        );
        expect(completePhase).toBeDefined();
      });

      it('emits complete event with summary', async () => {
        (scanAvailableBills as Mock).mockResolvedValue([1, 2]);
        (fetchBillXml as Mock).mockResolvedValue('<xml>test</xml>');
        (parseBillXml as Mock).mockReturnValue(mockParsedBill);
        (fetchBillTextFromUrl as Mock).mockResolvedValue('Bill text');
        (prisma.bill.findUnique as Mock)
          .mockResolvedValueOnce(null) // First bill - create
          .mockResolvedValueOnce({ id: 'existing' }); // Second bill - update

        await syncBillsWithProgress({ maxBills: 2, billTypes: ['HB'] as BillType[], syncUntilComplete: false }, eventCallback);

        const completeEvent = events.find(e => e.type === 'complete') as { type: 'complete'; data: SyncCompleteEvent };
        expect(completeEvent).toBeDefined();
        expect(completeEvent.data.success).toBe(true);
        // Total processed should be at least 1
        expect(completeEvent.data.summary.created + completeEvent.data.summary.updated).toBeGreaterThanOrEqual(1);
        expect(completeEvent.data.duration).toBeGreaterThanOrEqual(0);
      });

      it('includes error count in summary', async () => {
        (scanAvailableBills as Mock).mockResolvedValue([1, 2]);
        (fetchBillXml as Mock)
          .mockResolvedValueOnce('<xml>test</xml>')
          .mockResolvedValueOnce(null); // Fail second bill
        (parseBillXml as Mock).mockReturnValue(mockParsedBill);
        (fetchBillTextFromUrl as Mock).mockResolvedValue('Bill text');

        await syncBillsWithProgress({ maxBills: 2, syncUntilComplete: false }, eventCallback);

        const completeEvent = events.find(e => e.type === 'complete') as { type: 'complete'; data: SyncCompleteEvent };
        expect(completeEvent.data.summary.errors).toBe(1);
      });
    });

    describe('abort handling', () => {
      it('respects abort signal during FTP scan', async () => {
        const abortSignal = { aborted: true };
        (scanAvailableBills as Mock).mockResolvedValue([1, 2, 3]);

        await syncBillsWithProgress({ abortSignal }, eventCallback);

        // Should not process any bills since abort is signaled
        const billEvents = events.filter(e => e.type === 'bill');
        expect(billEvents.length).toBe(0);
      });

      it('respects abort signal during bill processing', async () => {
        let callCount = 0;
        const abortSignal = { aborted: false };

        (scanAvailableBills as Mock).mockResolvedValue([1, 2, 3, 4, 5]);
        (fetchBillXml as Mock).mockImplementation(() => {
          callCount++;
          if (callCount >= 2) {
            abortSignal.aborted = true;
          }
          return Promise.resolve('<xml>test</xml>');
        });
        (parseBillXml as Mock).mockReturnValue(mockParsedBill);
        (fetchBillTextFromUrl as Mock).mockResolvedValue('Bill text');

        await syncBillsWithProgress({ abortSignal, maxBills: 5, syncUntilComplete: false }, eventCallback);

        // Should stop after abort is signaled
        const logEvents = events.filter(e =>
          e.type === 'log' && (e.data as SyncLogEvent).message.includes('stopped by user')
        );
        expect(logEvents.length).toBeGreaterThan(0);
      });
    });

    describe('rate limiting', () => {
      it('applies rate limiting delay every 5 requests', async () => {
        const startTime = Date.now();
        (scanAvailableBills as Mock).mockResolvedValue([1, 2, 3, 4, 5, 6]);
        (fetchBillXml as Mock).mockResolvedValue('<xml>test</xml>');
        (parseBillXml as Mock).mockReturnValue(mockParsedBill);
        (fetchBillTextFromUrl as Mock).mockResolvedValue('Bill text');
        (getSettingTyped as Mock).mockImplementation((key: string) => {
          if (key === 'BATCH_DELAY_MS') return Promise.resolve(10);
          if (key === 'SYNC_ENABLED') return Promise.resolve(true);
          return Promise.resolve(null);
        });

        await syncBillsWithProgress({ maxBills: 6, syncUntilComplete: false }, eventCallback);

        const duration = Date.now() - startTime;
        // Should have at least one delay of 10ms after 5 bills
        expect(duration).toBeGreaterThanOrEqual(10);
      });
    });

    describe('error handling', () => {
      it('emits error event on unexpected exception', async () => {
        (getSetting as Mock).mockRejectedValue(new Error('Database connection failed'));

        await syncBillsWithProgress({}, eventCallback);

        const errorEvent = events.find(e => e.type === 'error') as { type: 'error'; data: SyncErrorEvent };
        expect(errorEvent).toBeDefined();
        expect(errorEvent.data.message).toBe('Database connection failed');
      });

      it('includes stack trace in error details', async () => {
        const testError = new Error('Test error');
        testError.stack = 'Error: Test error\n    at test.ts:1:1';
        (getSetting as Mock).mockRejectedValue(testError);

        await syncBillsWithProgress({}, eventCallback);

        const errorEvent = events.find(e => e.type === 'error') as { type: 'error'; data: SyncErrorEvent };
        expect(errorEvent.data.details).toContain('at test.ts');
      });
    });
  });
});
