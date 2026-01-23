import { logger } from './logger';
import { AuthEventContext } from './types';

/**
 * Mask an email address for logging
 * user@example.com -> u***r@example.com
 */
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!domain || localPart.length < 2) {
    return '***@***';
  }

  const firstChar = localPart[0];
  const lastChar = localPart[localPart.length - 1];
  return `${firstChar}***${lastChar}@${domain}`;
}

/**
 * Log an authentication event with masked email
 */
export function logAuthEvent(context: AuthEventContext): void {
  const { event, email, userId, reason, requestId, ip } = context;

  const logData: Record<string, unknown> = {
    event,
    requestId,
    ip,
  };

  if (email) {
    logData.email = maskEmail(email);
  }

  if (userId) {
    logData.userId = userId;
  }

  if (reason) {
    logData.reason = reason;
  }

  const isFailure = event.includes('failure');
  const message = `Auth: ${event}`;

  if (isFailure) {
    logger.warn(message, logData);
  } else {
    logger.info(message, logData);
  }
}
