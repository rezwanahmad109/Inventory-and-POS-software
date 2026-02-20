import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import pino, { Logger, LoggerOptions } from 'pino';

@Injectable()
export class AppLoggerService implements NestLoggerService {
  private readonly logger: Logger;

  constructor() {
    const level = process.env.LOG_LEVEL ?? 'info';
    const options: LoggerOptions = {
      level,
      base: {
        service: 'inventory-pos-backend',
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    };
    this.logger = pino(options);
  }

  log(message: unknown, context?: string): void {
    this.logger.info(this.buildPayload(message, context));
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.logger.error(this.buildPayload(message, context, trace));
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn(this.buildPayload(message, context));
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug(this.buildPayload(message, context));
  }

  verbose(message: unknown, context?: string): void {
    this.logger.trace(this.buildPayload(message, context));
  }

  fatal(message: unknown, context?: string): void {
    this.logger.fatal(this.buildPayload(message, context));
  }

  private buildPayload(
    message: unknown,
    context?: string,
    trace?: string,
  ): Record<string, unknown> {
    if (typeof message === 'object' && message !== null) {
      return {
        context,
        trace,
        ...message,
      };
    }

    return {
      context,
      trace,
      message: String(message),
    };
  }
}
