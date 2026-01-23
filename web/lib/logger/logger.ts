import pino, { Logger as PinoLogger } from 'pino';
import { LogContext, LogLevel } from './types';
import { addLog } from './log-store';

const isDevelopment = process.env.NODE_ENV === 'development';
const logLevel = (process.env.LOG_LEVEL as LogLevel) || (isDevelopment ? 'debug' : 'info');

/**
 * Create the base pino logger with environment-aware configuration
 */
function createPinoLogger(): PinoLogger {
  if (isDevelopment) {
    // Pretty output for development
    return pino({
      level: logLevel,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  // JSON output for production (Vercel logs)
  return pino({
    level: logLevel,
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

const pinoLogger = createPinoLogger();

/**
 * Logger class with context support
 */
class Logger {
  private pino: PinoLogger;
  private context: LogContext;

  constructor(pinoInstance: PinoLogger, context: LogContext = {}) {
    this.pino = pinoInstance;
    this.context = context;
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    return new Logger(this.pino.child(context), { ...this.context, ...context });
  }

  debug(message: string, data?: Record<string, unknown>): void {
    const mergedData = { ...this.context, ...data };
    this.pino.debug(mergedData, message);
    addLog('debug', message, mergedData);
  }

  info(message: string, data?: Record<string, unknown>): void {
    const mergedData = { ...this.context, ...data };
    this.pino.info(mergedData, message);
    addLog('info', message, mergedData);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    const mergedData = { ...this.context, ...data };
    this.pino.warn(mergedData, message);
    addLog('warn', message, mergedData);
  }

  error(message: string, data?: Record<string, unknown>): void {
    const mergedData = { ...this.context, ...data };
    this.pino.error(mergedData, message);
    addLog('error', message, mergedData);
  }
}

/**
 * Singleton logger instance for application-wide use
 */
export const logger = new Logger(pinoLogger);
