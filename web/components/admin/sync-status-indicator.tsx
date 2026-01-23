'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, PauseCircle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SyncJob {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'STOPPED' | 'ERROR';
  totalProcessed: number;
  totalCreated: number;
  totalUpdated: number;
  totalErrors: number;
  billTypes: string[];
  completedTypes: Record<string, boolean>;
  progressByType: Record<string, number>;
}

interface SyncStatusIndicatorProps {
  isAdmin?: boolean;
}

export function SyncStatusIndicator({ isAdmin = false }: SyncStatusIndicatorProps) {
  const router = useRouter();
  const [job, setJob] = useState<SyncJob | null>(null);
  const processingRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await fetch('/api/admin/sync/job');
      if (response.ok) {
        const data = await response.json();
        setJob(data.job);
        return data.job;
      }
    } catch {
      // Ignore errors
    }
    return null;
  }, [isAdmin]);

  // Process next batch if job is running
  const processNextBatch = useCallback(async () => {
    if (!job || job.status !== 'RUNNING' || processingRef.current) return;

    processingRef.current = true;
    try {
      const response = await fetch('/api/admin/sync/job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process', jobId: job.id }),
      });

      if (response.ok) {
        const data = await response.json();
        setJob(data.job);
      }
    } catch {
      // Will retry on next interval
    } finally {
      processingRef.current = false;
    }
  }, [job]);

  // Initial fetch and polling for status
  useEffect(() => {
    if (!isAdmin) return;

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [isAdmin, fetchStatus]);

  // Auto-process batches when running - this keeps sync going even when away from sync page
  useEffect(() => {
    if (!isAdmin || !job || job.status !== 'RUNNING') return;

    // Process immediately, then continue every 500ms
    const processLoop = async () => {
      if (processingRef.current) return;
      await processNextBatch();
    };

    processLoop();
    const interval = setInterval(processLoop, 500);
    return () => clearInterval(interval);
  }, [isAdmin, job?.status, job?.id, processNextBatch]);

  // Don't show if not admin
  if (!isAdmin) {
    return null;
  }

  // Don't show if no active job
  if (!job || job.status === 'COMPLETED' || job.status === 'STOPPED') {
    return null;
  }

  const handleClick = () => {
    router.push('/admin/sync');
  };

  const getStatusIcon = () => {
    switch (job.status) {
      case 'RUNNING':
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case 'PAUSED':
        return <PauseCircle className="h-3 w-3" />;
      case 'ERROR':
        return <AlertCircle className="h-3 w-3" />;
      default:
        return <Loader2 className="h-3 w-3" />;
    }
  };

  const getBillCount = () => {
    return job.totalCreated + job.totalUpdated;
  };

  const getVariant = () => {
    switch (job.status) {
      case 'RUNNING':
        return 'default';
      case 'PAUSED':
        return 'secondary';
      case 'ERROR':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusLabel = () => {
    switch (job.status) {
      case 'RUNNING':
        return 'Syncing';
      case 'PAUSED':
        return 'Paused';
      case 'ERROR':
        return 'Error';
      default:
        return 'Sync';
    }
  };

  return (
    <Badge
      variant={getVariant()}
      className="cursor-pointer flex items-center gap-1.5 px-2 py-1"
      onClick={handleClick}
      title={`Bill Sync ${job.status.toLowerCase()} - ${job.totalCreated} created, ${job.totalUpdated} updated. Click to view details.`}
    >
      {getStatusIcon()}
      <span className="text-xs font-medium">
        {getStatusLabel()}: {getBillCount()}
      </span>
    </Badge>
  );
}
