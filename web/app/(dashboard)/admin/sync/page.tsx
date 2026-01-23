'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  AlertTriangle,
  Pause,
  Play,
  Square,
} from 'lucide-react';

interface SyncStatus {
  totalBills: number;
  lastSyncAt: string | null;
  lastSyncedBill: string | null;
  billsByType: Record<string, number>;
  syncEnabled: boolean;
  sessionCode: string;
}

interface SyncJob {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'STOPPED' | 'ERROR';
  sessionCode: string;
  sessionName: string;
  billTypes: string[];
  progressByType: Record<string, number>;
  completedTypes: Record<string, boolean>;
  totalProcessed: number;
  totalCreated: number;
  totalUpdated: number;
  totalErrors: number;
  startedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  lastActivityAt: string;
  lastError: string | null;
}

export default function AdminSyncPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [job, setJob] = useState<SyncJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const { toast } = useToast();

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/sync/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data.status);
      }
    } catch {
      // Ignore
    }
  }, []);

  const fetchJob = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/sync/job');
      if (response.ok) {
        const data = await response.json();
        setJob(data.job);
        return data.job;
      }
    } catch {
      // Ignore
    }
    return null;
  }, []);

  // Initial load
  useEffect(() => {
    Promise.all([fetchStatus(), fetchJob()]).finally(() => setLoading(false));
  }, [fetchStatus, fetchJob]);

  // Poll for job and status updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchJob();
      fetchStatus();
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchJob, fetchStatus]);

  // Show toast when sync completes
  useEffect(() => {
    if (job?.status === 'COMPLETED') {
      toast({
        title: 'Sync complete',
        description: `Synced ${job.totalCreated + job.totalUpdated} bills`,
      });
    }
  }, [job?.status, job?.totalCreated, job?.totalUpdated, toast]);

  const handleStartSync = async () => {
    setConfirmOpen(false);
    try {
      const response = await fetch('/api/admin/sync/job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });

      if (response.ok) {
        const data = await response.json();
        setJob(data.job);
        toast({ title: 'Sync started', description: 'Background sync has begun' });
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to start sync',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to start sync',
        variant: 'destructive',
      });
    }
  };

  const handlePause = async () => {
    if (!job) return;
    try {
      const response = await fetch('/api/admin/sync/job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause', jobId: job.id }),
      });
      if (response.ok) {
        const data = await response.json();
        setJob(data.job);
        toast({ title: 'Sync paused' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to pause sync', variant: 'destructive' });
    }
  };

  const handleResume = async () => {
    if (!job) return;
    try {
      const response = await fetch('/api/admin/sync/job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume', jobId: job.id }),
      });
      if (response.ok) {
        const data = await response.json();
        setJob(data.job);
        toast({ title: 'Sync resumed' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to resume sync', variant: 'destructive' });
    }
  };

  const handleStop = async () => {
    if (!job) return;
    try {
      const response = await fetch('/api/admin/sync/job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop', jobId: job.id }),
      });
      if (response.ok) {
        const data = await response.json();
        setJob(data.job);
        fetchStatus();
        toast({ title: 'Sync stopped' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to stop sync', variant: 'destructive' });
    }
  };

  const handleClearData = async () => {
    setIsClearing(true);
    try {
      const response = await fetch('/api/admin/sync/clear', {
        method: 'DELETE',
        headers: { 'x-confirm-delete': 'CONFIRM_DELETE_ALL_DATA' },
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Data cleared',
          description: `Deleted ${data.deleted.bills} bills and related data`,
        });
        fetchStatus();
      } else {
        throw new Error('Failed to clear data');
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to clear legislative data',
        variant: 'destructive',
      });
    } finally {
      setIsClearing(false);
      setClearConfirmOpen(false);
    }
  };

  const isActive = job?.status === 'RUNNING' || job?.status === 'PAUSED';
  const isRunning = job?.status === 'RUNNING';
  const isPaused = job?.status === 'PAUSED';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Bill Sync</h2>
          <p className="text-muted-foreground">
            Manage bill synchronization from Texas Legislature
          </p>
        </div>
        <div className="flex gap-2">
          {/* Clear Data Button */}
          <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                disabled={isActive || isClearing || !status?.totalBills}
              >
                {isClearing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear Data
                  </>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Clear All Legislative Data
                </DialogTitle>
                <DialogDescription className="space-y-2">
                  <span className="block">
                    This will permanently delete all {status?.totalBills} bills and related data
                    from the database. This action cannot be undone.
                  </span>
                  <span className="block font-medium text-red-600">
                    Are you sure you want to continue?
                  </span>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setClearConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleClearData} disabled={isClearing}>
                  {isClearing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Clearing...
                    </>
                  ) : (
                    'Delete All Data'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Sync Button */}
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <Button disabled={isActive || !status?.syncEnabled}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Start Sync
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start Bill Sync</DialogTitle>
                <DialogDescription>
                  This will fetch all new bills from the Texas Legislature website and
                  update the database. The sync runs in the background - you can navigate
                  away and it will continue. You can pause or stop the sync at any time.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleStartSync}>Start Sync</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Sync Progress Card */}
      {isActive && job && (
        <Card className={isPaused ? 'border-yellow-500' : 'border-blue-500'}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {isRunning ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    Syncing {job.billTypes.find((t) => !job.completedTypes[t]) || 'bills'}...
                  </>
                ) : (
                  <>
                    <Pause className="h-5 w-5 text-yellow-500" />
                    Sync Paused
                  </>
                )}
              </CardTitle>
              <div className="flex gap-2">
                {isRunning ? (
                  <Button variant="outline" size="sm" onClick={handlePause}>
                    <Pause className="mr-1 h-4 w-4" />
                    Pause
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleResume}>
                    <Play className="mr-1 h-4 w-4" />
                    Resume
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleStop}>
                  <Square className="mr-1 h-4 w-4" />
                  Stop
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress by type */}
            <div className="space-y-2">
              {job.billTypes.map((type) => (
                <div key={type} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{type} Bills</span>
                    <span className="font-medium">
                      {job.completedTypes[type] ? (
                        <span className="text-green-600">Complete</span>
                      ) : (
                        `Checked up to ${type} ${job.progressByType[type] || 0}`
                      )}
                    </span>
                  </div>
                  <Progress
                    value={job.completedTypes[type] ? 100 : undefined}
                    className="h-2"
                  />
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Created:</span>
                <span className="font-medium text-green-600">{job.totalCreated}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Updated:</span>
                <span className="font-medium text-blue-600">{job.totalUpdated}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Errors:</span>
                <span className="font-medium text-red-600">{job.totalErrors}</span>
              </div>
              {isRunning && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Processing batches...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed message */}
      {job?.status === 'COMPLETED' && (
        <Card className="border-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Sync Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm text-muted-foreground">Processed</p>
                <p className="text-2xl font-bold">{job.totalProcessed}</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="text-2xl font-bold text-green-600">{job.totalCreated}</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm text-muted-foreground">Updated</p>
                <p className="text-2xl font-bold text-blue-600">{job.totalUpdated}</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm text-muted-foreground">Errors</p>
                <p className="text-2xl font-bold text-red-600">{job.totalErrors}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sync Status</CardTitle>
            {status?.syncEnabled ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.syncEnabled ? 'Enabled' : 'Disabled'}
            </div>
            <p className="text-xs text-muted-foreground">
              Session: {status?.sessionCode}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.totalBills ?? 0}</div>
            <p className="text-xs text-muted-foreground">Bills in database</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.lastSyncAt
                ? new Date(status.lastSyncAt).toLocaleDateString()
                : 'Never'}
            </div>
            <p className="text-xs text-muted-foreground">
              {status?.lastSyncAt
                ? new Date(status.lastSyncAt).toLocaleTimeString()
                : 'No sync recorded'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bills by Type */}
      {status?.billsByType && Object.keys(status.billsByType).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bills by Type</CardTitle>
            <CardDescription>Distribution of bills in the database</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(status.billsByType).map(([type, count]) => (
                <Badge key={type} variant="secondary" className="text-sm">
                  {type}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warning if sync disabled */}
      {!status?.syncEnabled && (
        <Card className="border-yellow-500">
          <CardHeader>
            <CardTitle className="text-yellow-600">Sync Disabled</CardTitle>
            <CardDescription>
              Bill synchronization is currently disabled. Enable it in the settings to
              allow manual or automatic syncing.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
