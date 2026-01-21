'use client';

import { useState, useCallback, useRef } from 'react';
import type {
  SyncPhaseEvent,
  SyncProgressEvent,
  SyncBillEvent,
  SyncCompleteEvent,
  SyncLogEvent,
} from '@/lib/admin/sync/bill-sync-stream';

export interface UseSyncStreamReturn {
  startSync: () => void;
  isConnecting: boolean;
  isSyncing: boolean;
  phase: SyncPhaseEvent | null;
  progress: SyncProgressEvent | null;
  stats: { created: number; updated: number; errors: number };
  recentBills: SyncBillEvent[];
  logs: SyncLogEvent[];
  result: SyncCompleteEvent | null;
  error: string | null;
  abort: () => void;
  reset: () => void;
}

const MAX_RECENT_BILLS = 20;
const MAX_LOGS = 50;

export function useSyncStream(): UseSyncStreamReturn {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [phase, setPhase] = useState<SyncPhaseEvent | null>(null);
  const [progress, setProgress] = useState<SyncProgressEvent | null>(null);
  const [stats, setStats] = useState({ created: 0, updated: 0, errors: 0 });
  const [recentBills, setRecentBills] = useState<SyncBillEvent[]>([]);
  const [logs, setLogs] = useState<SyncLogEvent[]>([]);
  const [result, setResult] = useState<SyncCompleteEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setIsConnecting(false);
    setIsSyncing(false);
    setPhase(null);
    setProgress(null);
    setStats({ created: 0, updated: 0, errors: 0 });
    setRecentBills([]);
    setLogs([]);
    setResult(null);
    setError(null);
  }, []);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsConnecting(false);
    setIsSyncing(false);
  }, []);

  const startSync = useCallback(async () => {
    // Reset state
    reset();
    setIsConnecting(true);

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/admin/sync/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      setIsConnecting(false);
      setIsSyncing(true);

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let currentEvent = '';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6);
          } else if (line === '' && currentEvent && currentData) {
            // End of event, process it
            try {
              const data = JSON.parse(currentData);
              processEvent(currentEvent, data);
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
            currentEvent = '';
            currentData = '';
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User aborted, don't set error
        return;
      }
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsConnecting(false);
      setIsSyncing(false);
      abortControllerRef.current = null;
    }

    function processEvent(event: string, data: unknown) {
      switch (event) {
        case 'phase':
          setPhase(data as SyncPhaseEvent);
          break;

        case 'progress':
          setProgress(data as SyncProgressEvent);
          break;

        case 'bill': {
          const billEvent = data as SyncBillEvent;
          // Update stats
          setStats((prev) => ({
            created: prev.created + (billEvent.status === 'created' ? 1 : 0),
            updated: prev.updated + (billEvent.status === 'updated' ? 1 : 0),
            errors: prev.errors + (billEvent.status === 'error' ? 1 : 0),
          }));
          // Add to recent bills (keep last N)
          setRecentBills((prev) => {
            const newBills = [billEvent, ...prev].slice(0, MAX_RECENT_BILLS);
            return newBills;
          });
          break;
        }

        case 'complete':
          setResult(data as SyncCompleteEvent);
          setIsSyncing(false);
          break;

        case 'error': {
          const errorData = data as { message: string };
          setError(errorData.message);
          setIsSyncing(false);
          break;
        }

        case 'log': {
          const logEvent = data as SyncLogEvent;
          setLogs((prev) => {
            const newLogs = [...prev, logEvent].slice(-MAX_LOGS);
            return newLogs;
          });
          break;
        }
      }
    }
  }, [reset]);

  return {
    startSync,
    isConnecting,
    isSyncing,
    phase,
    progress,
    stats,
    recentBills,
    logs,
    result,
    error,
    abort,
    reset,
  };
}
