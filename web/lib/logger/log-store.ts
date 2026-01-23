/**
 * In-memory log storage for admin log viewer
 * Keeps recent logs in a circular buffer for viewing in the admin UI
 */

export interface StoredLog {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  data?: Record<string, unknown>;
}

const MAX_LOGS = 1000;
const logs: StoredLog[] = [];
let logIdCounter = 0;

/**
 * Add a log entry to the store
 */
export function addLog(level: string, message: string, data?: Record<string, unknown>): void {
  const log: StoredLog = {
    id: `log_${Date.now()}_${++logIdCounter}`,
    timestamp: new Date().toISOString(),
    level,
    message,
    data,
  };

  logs.push(log);

  // Keep buffer size under control
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }
}

/**
 * Get logs with optional filtering
 */
export function getLogs(options?: {
  level?: string;
  search?: string;
  limit?: number;
  after?: string;
}): StoredLog[] {
  let result = [...logs];

  // Filter by level
  if (options?.level && options.level !== 'all') {
    result = result.filter((log) => log.level === options.level);
  }

  // Filter by search term
  if (options?.search) {
    const searchLower = options.search.toLowerCase();
    result = result.filter(
      (log) =>
        log.message.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.data || {}).toLowerCase().includes(searchLower)
    );
  }

  // Filter logs after a certain ID (for polling new logs)
  if (options?.after) {
    const afterIndex = result.findIndex((log) => log.id === options.after);
    if (afterIndex !== -1) {
      result = result.slice(afterIndex + 1);
    }
  }

  // Apply limit (most recent first)
  result = result.reverse();
  if (options?.limit) {
    result = result.slice(0, options.limit);
  }

  return result;
}

/**
 * Clear all logs
 */
export function clearLogs(): void {
  logs.length = 0;
}

/**
 * Get log statistics
 */
export function getLogStats(): {
  total: number;
  byLevel: Record<string, number>;
} {
  const byLevel: Record<string, number> = {};

  for (const log of logs) {
    byLevel[log.level] = (byLevel[log.level] || 0) + 1;
  }

  return {
    total: logs.length,
    byLevel,
  };
}
