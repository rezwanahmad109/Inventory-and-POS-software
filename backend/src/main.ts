import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { AppLoggerService } from './common/services/logger.service';

function parseAllowedOrigins(rawValue: string): string[] {
  return rawValue
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: false,
  });
  const configService = app.get(ConfigService);
  const logger = app.get(AppLoggerService);
  app.useLogger(logger);

  app.set('trust proxy', 1);
  app.use(helmet());

  const allowedOrigins = parseAllowedOrigins(
    configService.getOrThrow<string>('CORS_ORIGINS'),
  );

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin is not allowed by CORS policy.'));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['Content-Disposition'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter(logger));
  app.useGlobalInterceptors(
    new RequestLoggingInterceptor(logger),
    new ResponseEnvelopeInterceptor(),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Inventory & POS API')
    .setDescription('Secure backend API for Inventory and POS operations')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  app.useStaticAssets(join(process.cwd(), 'exports'), {
    prefix: '/downloads/',
  });

  const port = Number(configService.getOrThrow<string>('PORT'));
  await app.listen(port);
}

void bootstrap();
