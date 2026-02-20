import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { AppLoggerService } from '../services/logger.service';

interface ErrorResponsePayload {
  statusCode: number;
  message: string;
  errors: string[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload = this.resolvePayload(status, exception);

    this.logger.error(
      {
        event: 'http_exception',
        method: request.method,
        path: request.originalUrl,
        statusCode: payload.statusCode,
        message: payload.message,
        errors: payload.errors,
      },
      exception instanceof Error ? exception.stack : undefined,
      HttpExceptionFilter.name,
    );

    response.status(payload.statusCode).json({
      statusCode: payload.statusCode,
      success: false,
      message: payload.message,
      errors: payload.errors,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }

  private resolvePayload(
    status: number,
    exception: unknown,
  ): ErrorResponsePayload {
    if (!(exception instanceof HttpException)) {
      return {
        statusCode: status,
        message: 'Internal server error',
        errors: ['Internal server error'],
      };
    }

    const exceptionResponse = exception.getResponse();
    if (typeof exceptionResponse === 'string') {
      return {
        statusCode: status,
        message: exceptionResponse,
        errors: [exceptionResponse],
      };
    }

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const payload = exceptionResponse as {
        message?: unknown;
        errors?: unknown;
      };

      const errors = this.resolveErrors(payload.message, payload.errors);
      return {
        statusCode: status,
        message: errors[0] ?? exception.message,
        errors,
      };
    }

    return {
      statusCode: status,
      message: exception.message,
      errors: [exception.message],
    };
  }

  private resolveErrors(message: unknown, errors: unknown): string[] {
    if (Array.isArray(errors)) {
      const normalized = errors
        .map((entry) => String(entry))
        .filter((entry) => entry.trim().length > 0);
      if (normalized.length > 0) {
        return normalized;
      }
    }

    if (Array.isArray(message)) {
      const normalized = message
        .map((entry) => String(entry))
        .filter((entry) => entry.trim().length > 0);
      if (normalized.length > 0) {
        return normalized;
      }
    }

    if (typeof message === 'string' && message.trim().length > 0) {
      return [message];
    }

    return ['Request failed'];
  }
}
