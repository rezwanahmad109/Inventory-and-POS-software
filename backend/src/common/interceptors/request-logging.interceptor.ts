import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

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
            `${request.method} ${request.originalUrl} ${response.statusCode} ${durationMs}ms requestId=${requestId ?? '-'}`,
          );
        },
        error: (error: unknown) => {
          const durationMs = Date.now() - now;
          const message =
            error instanceof Error ? error.message : 'Unknown request error';
          this.logger.warn(
            `${request.method} ${request.originalUrl} ${response.statusCode} ${durationMs}ms requestId=${requestId ?? '-'} error=${message}`,
          );
        },
      }),
    );
  }
}
