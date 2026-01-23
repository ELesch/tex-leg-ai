'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { RefreshCw, Loader2, CheckCircle, XCircle, Clock, Trash2, AlertTriangle } from 'lucide-react';
import { useSyncStream } from '@/hooks/use-sync-stream';
import { SyncProgress } from '@/components/admin/sync-progress';

interface SyncStatus {
  totalBills: number;
  lastSyncAt: string | null;
  lastSyncedBill: string | null;
  billsByType: Record<string, number>;
  syncEnabled: boolean;
  sessionCode: string;
}

export default function AdminSyncPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const { toast } = useToast();

  const syncStream = useSyncStream();
  const { isConnecting, isSyncing, isPaused, result, error, startSync, reset } = syncStream;

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/sync/status');
      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }
      const data = await response.json();
      setStatus(data.status);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch sync status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Refresh status when sync completes
  useEffect(() => {
    if (result) {
      fetchStatus();
      toast({
        title: 'Sync complete',
        description: `Synced ${result.summary.fetched} bills (${result.summary.created} new, ${result.summary.updated} updated)`,
      });
    }
  }, [result, fetchStatus, toast]);

  // Show toast on error
  useEffect(() => {
    if (error) {
      toast({
        title: 'Sync failed',
        description: error,
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  const handleStartSync = () => {
    setConfirmOpen(false);
    startSync({ syncUntilComplete: true });
  };

  const handleRetry = () => {
    reset();
    startSync({ syncUntilComplete: true });
  };

  const handleClearData = async () => {
    setIsClearing(true);
    try {
      const response = await fetch('/api/admin/sync/clear', {
        method: 'DELETE',
        headers: {
          'x-confirm-delete': 'CONFIRM_DELETE_ALL_DATA',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to clear data');
      }

      const data = await response.json();
      toast({
        title: 'Data cleared',
        description: `Deleted ${data.deleted.bills} bills and related data`,
      });
      fetchStatus();
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

  const syncing = isConnecting || isSyncing;

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
                disabled={syncing || isPaused || isClearing || !status?.totalBills}
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
              <Button disabled={syncing || isPaused || !status?.syncEnabled}>
                {syncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Start Sync
                  </>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start Bill Sync</DialogTitle>
                <DialogDescription>
                  This will fetch all new bills from the Texas Legislature website and
                  update the database. The sync will continue until all bill types have
                  been fully checked. You can pause or stop the sync at any time.
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

      {/* Sync Progress */}
      <SyncProgress syncState={syncStream} onRetry={handleRetry} />

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
