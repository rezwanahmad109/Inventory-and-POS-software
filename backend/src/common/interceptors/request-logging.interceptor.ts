import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { AppLoggerService } from '../services/logger.service';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const now = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const requestId = request.headers['x-request-id'];

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - now;
          this.logger.log(
            {
              event: 'http_request',
              method: request.method,
              path: request.originalUrl,
              statusCode: response.statusCode,
              durationMs,
              requestId: requestId ?? '-',
            },
            RequestLoggingInterceptor.name,
          );
        },
        error: (error: unknown) => {
          const durationMs = Date.now() - now;
          const message =
            error instanceof Error ? error.message : 'Unknown request error';
          this.logger.warn(
            {
              event: 'http_request_error',
              method: request.method,
              path: request.originalUrl,
              statusCode: response.statusCode,
              durationMs,
              requestId: requestId ?? '-',
              error: message,
            },
            RequestLoggingInterceptor.name,
          );
        },
      }),
    );
  }
}
