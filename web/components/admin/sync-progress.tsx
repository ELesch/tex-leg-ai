'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { UseSyncStreamReturn } from '@/hooks/use-sync-stream';
import type { SyncLogEvent } from '@/lib/admin/sync/bill-sync-stream';

interface SyncProgressProps {
  syncState: UseSyncStreamReturn;
  onRetry?: () => void;
}

interface DebugLogSectionProps {
  logs: SyncLogEvent[];
  expanded: boolean;
  onToggle: () => void;
}

function DebugLogSection({ logs, expanded, onToggle }: DebugLogSectionProps) {
  if (logs.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        Debug Log ({logs.length} entries)
      </button>
      {expanded && (
        <ScrollArea className="h-40 rounded-md border bg-muted/50 mt-2">
          <div className="p-2 space-y-1 font-mono text-xs">
            {logs.map((log, index) => (
              <div
                key={index}
                className={
                  log.level === 'error'
                    ? 'text-red-600'
                    : log.level === 'warn'
                      ? 'text-yellow-600'
                      : 'text-muted-foreground'
                }
              >
                [{log.level.toUpperCase()}] {log.message}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

export function SyncProgress({ syncState, onRetry }: SyncProgressProps) {
  const {
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
  } = syncState;

  const [logsExpanded, setLogsExpanded] = useState(false);

  // Auto-expand logs while syncing, auto-collapse on completion
  useEffect(() => {
    if (isSyncing || isConnecting) {
      setLogsExpanded(true);
    } else if (result || error) {
      setLogsExpanded(false);
    }
  }, [isSyncing, isConnecting, result, error]);

  // Don't render if not active and no result/error
  if (!isConnecting && !isSyncing && !result && !error) {
    return null;
  }

  // Connecting state
  if (isConnecting) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Connecting...</span>
          </div>
          <DebugLogSection
            logs={logs}
            expanded={logsExpanded}
            onToggle={() => setLogsExpanded(!logsExpanded)}
          />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error && !isSyncing) {
    return (
      <Card className="border-red-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            Sync Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          {onRetry && (
            <Button variant="outline" onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          )}
          <DebugLogSection
            logs={logs}
            expanded={logsExpanded}
            onToggle={() => setLogsExpanded(!logsExpanded)}
          />
        </CardContent>
      </Card>
    );
  }

  // Complete state
  if (result && !isSyncing) {
    return (
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
              <p className="text-sm text-muted-foreground">Fetched</p>
              <p className="text-2xl font-bold">{result.summary.fetched}</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="text-2xl font-bold text-green-600">
                {result.summary.created}
              </p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm text-muted-foreground">Updated</p>
              <p className="text-2xl font-bold text-blue-600">
                {result.summary.updated}
              </p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm text-muted-foreground">Errors</p>
              <p className="text-2xl font-bold text-red-600">
                {result.summary.errors}
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Completed in {(result.duration / 1000).toFixed(1)}s
          </p>
          <DebugLogSection
            logs={logs}
            expanded={logsExpanded}
            onToggle={() => setLogsExpanded(!logsExpanded)}
          />
        </CardContent>
      </Card>
    );
  }

  // In Progress state
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            {phase?.message || 'Syncing...'}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={abort}>
            Cancel
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        {progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Processing {progress.billType} bills
              </span>
              <span className="font-medium">
                {progress.percent}% ({progress.current}/{progress.total})
              </span>
            </div>
            <Progress value={progress.percent} />
          </div>
        )}

        {/* Stats */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Created:</span>
            <span className="font-medium text-green-600">{stats.created}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Updated:</span>
            <span className="font-medium text-blue-600">{stats.updated}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Errors:</span>
            <span className="font-medium text-red-600">{stats.errors}</span>
          </div>
        </div>

        {/* Recent activity */}
        {recentBills.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Recent Activity</h4>
            <ScrollArea className="h-32 rounded-md border">
              <div className="p-2 space-y-1">
                {recentBills.map((bill, index) => (
                  <div
                    key={`${bill.billId}-${index}`}
                    className="flex items-center gap-2 text-sm"
                  >
                    {bill.status === 'created' && (
                      <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                    )}
                    {bill.status === 'updated' && (
                      <CheckCircle className="h-3 w-3 text-blue-500 flex-shrink-0" />
                    )}
                    {bill.status === 'error' && (
                      <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                    )}
                    {bill.status === 'skipped' && (
                      <span className="h-3 w-3 text-muted-foreground flex-shrink-0">-</span>
                    )}
                    <span className="font-mono text-xs">{bill.billId}</span>
                    <span className="text-muted-foreground text-xs">
                      {bill.status}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Debug logs */}
        <DebugLogSection
          logs={logs}
          expanded={logsExpanded}
          onToggle={() => setLogsExpanded(!logsExpanded)}
        />
      </CardContent>
    </Card>
  );
}
