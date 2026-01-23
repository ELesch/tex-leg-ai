/**
 * Log level types
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Context that can be attached to log messages
 */
export interface LogContext {
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  [key: string]: unknown;
}

/**
 * Auth event types for security logging
 */
export type AuthEventType =
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'register_success'
  | 'register_failure'
  | 'password_reset_request'
  | 'password_reset_success';

/**
 * Auth event context for logging
 */
export interface AuthEventContext {
  event: AuthEventType;
  email?: string;
  userId?: string;
  reason?: string;
  requestId?: string;
  ip?: string;
}

/**
 * Payload for client-side error reporting
 */
export interface ClientErrorPayload {
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  timestamp: string;
  componentStack?: string;
}
