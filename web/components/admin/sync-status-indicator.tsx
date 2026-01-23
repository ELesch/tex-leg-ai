'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, PauseCircle, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SyncJob {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'STOPPED' | 'ERROR';
  totalProcessed: number;
  totalCreated: number;
  totalUpdated: number;
  totalErrors: number;
  billTypes: string[];
  completedTypes: Record<string, boolean>;
}

interface SyncStatusIndicatorProps {
  isAdmin?: boolean;
}

export function SyncStatusIndicator({ isAdmin = false }: SyncStatusIndicatorProps) {
  const router = useRouter();
  const [job, setJob] = useState<SyncJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/sync/job');
      if (response.ok) {
        const data = await response.json();
        setJob(data.job);
      }
    } catch {
      // Ignore errors for non-admins
    }
  }, []);

  // Process next batch if job is running
  const processNextBatch = useCallback(async () => {
    if (!job || job.status !== 'RUNNING' || isProcessing) return;

    setIsProcessing(true);
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
      setIsProcessing(false);
    }
  }, [job, isProcessing]);

  // Poll for status
  useEffect(() => {
    if (!isAdmin) return;

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [isAdmin, fetchStatus]);

  // Auto-process when running
  useEffect(() => {
    if (!isAdmin || !job || job.status !== 'RUNNING') return;

    // Immediately process next batch when running
    const timeout = setTimeout(processNextBatch, 100);
    return () => clearTimeout(timeout);
  }, [isAdmin, job, processNextBatch]);

  // Don't show if not admin or no active job
  if (!isAdmin || !job || job.status === 'COMPLETED' || job.status === 'STOPPED') {
    return null;
  }

  const handleClick = () => {
    router.push('/admin/sync');
  };

  const getStatusIcon = () => {
    switch (job.status) {
      case 'RUNNING':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'PAUSED':
        return <PauseCircle className="h-4 w-4 text-yellow-500" />;
      case 'ERROR':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getStatusText = () => {
    const completedCount = Object.values(job.completedTypes).filter(Boolean).length;
    const totalTypes = job.billTypes.length;

    switch (job.status) {
      case 'RUNNING':
        return `Syncing... (${job.totalCreated + job.totalUpdated} bills)`;
      case 'PAUSED':
        return `Paused (${job.totalCreated + job.totalUpdated} bills)`;
      case 'ERROR':
        return 'Sync error';
      default:
        return `${completedCount}/${totalTypes} types done`;
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="flex items-center gap-2 h-8 px-2"
      onClick={handleClick}
      title={`Bill Sync ${job.status.toLowerCase()} - ${job.totalCreated} created, ${job.totalUpdated} updated. Click to view details.`}
    >
      {getStatusIcon()}
      <span className="text-xs hidden sm:inline">{getStatusText()}</span>
    </Button>
  );
}
