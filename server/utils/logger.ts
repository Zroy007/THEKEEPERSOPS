import { sanitizeForLogging } from './sanitizer.js';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: any;
}

class Logger {
  private isProduction = process.env.NODE_ENV === 'production';

  private output(level: LogLevel, context: string, message: string, data?: any) {
    const sanitizedData = data ? sanitizeForLogging(data) : undefined;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      ...(sanitizedData ? { data: sanitizedData } : {}),
    };

    if (this.isProduction) {
      // Structured JSON logs for Cloud Logging / Cloud Run
      const stream = level === 'ERROR' ? process.stderr : process.stdout;
      stream.write(JSON.stringify(entry) + '\n');
    } else {
      // Human-readable dev output
      const prefix = `[${entry.timestamp}] [${level}] [${context}]`;
      if (level === 'ERROR') {
        console.error(prefix, message, sanitizedData ? sanitizedData : '');
      } else if (level === 'WARN') {
        console.warn(prefix, message, sanitizedData ? sanitizedData : '');
      } else {
        console.log(prefix, message, sanitizedData ? sanitizedData : '');
      }
    }
  }

  debug(context: string, message: string, data?: any) {
    if (!this.isProduction) {
      this.output('DEBUG', context, message, data);
    }
  }

  info(context: string, message: string, data?: any) {
    this.output('INFO', context, message, data);
  }

  warn(context: string, message: string, data?: any) {
    this.output('WARN', context, message, data);
  }

  error(context: string, message: string, errorOrData?: any) {
    const errorData = errorOrData instanceof Error 
      ? { message: errorOrData.message, stack: this.isProduction ? undefined : errorOrData.stack }
      : errorOrData;
    this.output('ERROR', context, message, errorData);
  }
}

export const logger = new Logger();
