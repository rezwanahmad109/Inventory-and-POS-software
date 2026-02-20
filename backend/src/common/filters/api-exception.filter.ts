import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const errors = this.resolveErrors(exceptionResponse, exception);
    const message = this.resolveMessage(errors, exception);

    response.status(status).json({
      statusCode: status,
      message,
      errors,
    });
  }

  private resolveErrors(
    exceptionResponse: string | object | null,
    exception: unknown,
  ): string[] {
    if (typeof exceptionResponse === 'string') {
      return [exceptionResponse];
    }

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const payload = exceptionResponse as {
        message?: unknown;
        errors?: unknown;
      };

      if (Array.isArray(payload.errors)) {
        return payload.errors
          .map((error) => String(error))
          .filter((error) => error.trim().length > 0);
      }

      if (Array.isArray(payload.message)) {
        return payload.message
          .map((message) => String(message))
          .filter((message) => message.trim().length > 0);
      }

      if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
        return [payload.message];
      }
    }

    if (exception instanceof Error) {
      return [exception.message];
    }

    return ['Internal server error'];
  }

  private resolveMessage(errors: string[], exception: unknown): string {
    if (errors.length > 0) {
      return errors[0];
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'Request failed';
  }
}
