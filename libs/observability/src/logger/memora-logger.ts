import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import { getRequestId } from '../correlation/correlation-context';

export interface MemoraLoggerOptions {
  readonly service: string;
  readonly nodeEnv: 'development' | 'production' | 'test';
}

const SENSITIVE =
  /(authorization|set-cookie|cookie|password|passwd|secret|token|refresh[_-]?token|access[_-]?token|id_token|biometric)/i;

export class MemoraLogger extends ConsoleLogger {
  private readonly serviceName: string;
  private readonly json: boolean;

  constructor(options: MemoraLoggerOptions) {
    const json = options.nodeEnv === 'production';
    super({
      json,
      colors: !json,
      prefix: options.service,
      logLevels: logLevelsFor(options.nodeEnv),
    });
    this.serviceName = options.service;
    this.json = json;
  }

  protected stringifyMessage(message: unknown, logLevel: LogLevel): string {
    const safeMessage = redact(message);
    const formatted: unknown = super.stringifyMessage(safeMessage, logLevel);
    if (this.json) {
      return String(formatted);
    }
    const requestId = getRequestId();
    const prefix = requestId === undefined ? '' : `[requestId=${requestId}] `;
    return `${prefix}${String(formatted)}`;
  }

  protected getJsonLogObject(
    message: unknown,
    options: {
      context: string;
      logLevel: LogLevel;
      writeStreamType?: 'stdout' | 'stderr';
      errorStack?: unknown;
    },
  ): {
    level: LogLevel;
    pid: number;
    timestamp: number;
    message: unknown;
    service: string;
    requestId?: string;
    context?: string;
    stack?: unknown;
  } {
    const base = super.getJsonLogObject(redact(message), options);
    const requestId = getRequestId();
    return {
      ...base,
      service: this.serviceName,
      ...(requestId === undefined ? {} : { requestId }),
    };
  }

  protected stringifyReplacer(key: string, value: unknown): unknown {
    if (SENSITIVE.test(key)) {
      return '[REDACTED]';
    }
    return super.stringifyReplacer(key, value);
  }
}

export function createMemoraLogger(options: MemoraLoggerOptions): MemoraLogger {
  return new MemoraLogger(options);
}

function logLevelsFor(nodeEnv: MemoraLoggerOptions['nodeEnv']): LogLevel[] {
  if (nodeEnv === 'production') {
    return ['log', 'warn', 'error', 'fatal'];
  }
  return ['debug', 'log', 'verbose', 'warn', 'error', 'fatal'];
}

function redact(message: unknown): unknown {
  if (typeof message === 'string') {
    return SENSITIVE.test(message) ? '[REDACTED]' : message;
  }
  return message;
}
