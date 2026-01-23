// Core logger
export { logger } from './logger';

// Context helpers
export {
  REQUEST_ID_HEADER,
  generateRequestId,
  getClientIp,
  createRequestLogger,
} from './context';

// Auth logging
export { maskEmail, logAuthEvent } from './auth-logger';

// Log store (for admin UI)
export {
  addLog,
  getLogs,
  clearLogs,
  getLogStats,
  type StoredLog,
} from './log-store';

// Types
export type {
  LogLevel,
  LogContext,
  AuthEventType,
  AuthEventContext,
  ClientErrorPayload,
} from './types';
