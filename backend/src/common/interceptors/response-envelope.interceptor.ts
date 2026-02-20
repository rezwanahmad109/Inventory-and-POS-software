import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface ApiSuccessEnvelope<T> {
  statusCode: number;
  message: string;
  data: T;
}

@Injectable()
export class ResponseEnvelopeInterceptor<T>
  implements NestInterceptor<T, ApiSuccessEnvelope<T> | T>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessEnvelope<T> | T> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((body: T) => {
        if (!this.shouldWrap(body)) {
          return body;
        }

        const statusCode = response?.statusCode ?? 200;
        return {
          statusCode,
          message: this.resolveMessage(statusCode),
          data: body,
        };
      }),
    );
  }

  private shouldWrap(body: unknown): boolean {
    if (body instanceof StreamableFile || Buffer.isBuffer(body)) {
      return false;
    }

    if (
      body !== null &&
      typeof body === 'object' &&
      'statusCode' in body &&
      'message' in body &&
      ('data' in body || 'errors' in body)
    ) {
      return false;
    }

    return true;
  }

  private resolveMessage(statusCode: number): string {
    if (statusCode >= 200 && statusCode < 300) {
      return 'Success';
    }
    return 'Request completed';
  }
}
