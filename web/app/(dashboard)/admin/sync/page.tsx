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
import { RefreshCw, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
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
  const { toast } = useToast();

  const syncStream = useSyncStream();
  const { isConnecting, isSyncing, result, error, startSync, reset } = syncStream;

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
    startSync();
  };

  const handleRetry = () => {
    reset();
    startSync();
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
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <Button disabled={syncing || !status?.syncEnabled}>
              {syncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Trigger Sync
                </>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Sync</DialogTitle>
              <DialogDescription>
                This will fetch the latest bills from the Texas Legislature website and
                update the database. This may take several minutes depending on the
                number of bills.
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
