import { Logger, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createHttpValidationPipe, HttpExceptionFilter } from '@app/common';
import type { NodeEnvName } from '@app/config';
import { createMemoraLogger, requestIdMiddleware } from '@app/observability';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import {
  CORS_ALLOWED_HEADERS,
  CORS_ALLOWED_METHODS,
  CORS_EXPOSED_HEADERS,
  resolveCorsOrigin,
} from './config/cors.policy';
import { setupSwagger } from './config/swagger.config';
import { applyTrustProxy } from './config/trust-proxy';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('apiGateway.port');
  const nodeEnv = configService.getOrThrow<NodeEnvName>('apiGateway.nodeEnv');
  const corsAllowedOrigins = configService.getOrThrow<string[]>(
    'apiGateway.corsAllowedOrigins',
  );
  const trustProxyHops =
    configService.get<false | number>('apiGateway.trustProxyHops') ?? false;

  app.useLogger(
    createMemoraLogger({
      service: 'api-gateway',
      nodeEnv,
    }),
  );
  applyTrustProxy((key, value) => {
    app.set(key, value);
  }, trustProxyHops);
  app.use(requestIdMiddleware);
  app.use(cookieParser());
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean | string) => void,
    ) => {
      if (origin === undefined || origin.length === 0) {
        callback(null, true);
        return;
      }
      callback(null, resolveCorsOrigin(origin, corsAllowedOrigins));
    },
    credentials: true,
    methods: [...CORS_ALLOWED_METHODS],
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
    exposedHeaders: [...CORS_EXPOSED_HEADERS],
    maxAge: 600,
    optionsSuccessStatus: 204,
  });
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });
  app.useGlobalPipes(createHttpValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  setupSwagger(app, configService);

  await app.listen(port);
  Logger.log(`API Gateway running on port ${port}`, 'Bootstrap');
}

void bootstrap();
