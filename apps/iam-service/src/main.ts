import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { GrpcExceptionFilter } from '@app/common';
import { loadIamRuntimeConfig } from '@app/config';
import { createMemoraLogger } from '@app/observability';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { join } from 'node:path';
import { IamReadinessService } from './application/ops/iam-readiness.service';
import { IamServiceModule } from './iam-service.module';
import {
  IAM_POSTGRES_DATABASE,
  IAM_POSTGRES_SCHEMA,
} from './persistence/prisma/iam-postgres.constants';
import { PrismaService } from './persistence/prisma/prisma.service';
import { RedisService } from './persistence/redis/redis.service';

async function bootstrap() {
  const iam = loadIamRuntimeConfig();
  const grpcUrl = `${iam.IAM_GRPC_HOST}:${iam.IAM_GRPC_PORT}`;
  const logger = createMemoraLogger({
    service: 'iam-service',
    nodeEnv: iam.NODE_ENV,
  });
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    IamServiceModule,
    {
      logger,
      transport: Transport.GRPC,
      options: {
        url: grpcUrl,
        package: ['memora.iam.v1', 'grpc.health.v1'],
        protoPath: [
          join(process.cwd(), 'proto/iam/v1/iam.proto'),
          join(process.cwd(), 'proto/grpc/health/v1/health.proto'),
        ],
        loader: {
          includeDirs: [join(process.cwd(), 'proto')],
          longs: String,
          keepCase: false,
        },
      },
    },
  );

  app.useGlobalFilters(new GrpcExceptionFilter());
  app.enableShutdownHooks();
  await app.listen();
  app.get(PrismaService);
  app.get(RedisService);
  const healthServer = startHealthHttpServer(
    iam.IAM_HEALTH_HOST,
    iam.IAM_HEALTH_PORT,
    app.get(IamReadinessService),
  );
  const closeHealthServer = () => {
    healthServer.close();
  };
  process.once('SIGTERM', closeHealthServer);
  process.once('SIGINT', closeHealthServer);
  Logger.log(
    `IAM PostgreSQL connected (database=${IAM_POSTGRES_DATABASE}, schema=${IAM_POSTGRES_SCHEMA})`,
    'Bootstrap',
  );
  Logger.log('IAM Redis connected', 'Bootstrap');
  Logger.log(`IAM gRPC Service running on ${grpcUrl}`, 'Bootstrap');
  Logger.log(
    `IAM health listening on ${iam.IAM_HEALTH_HOST}:${iam.IAM_HEALTH_PORT}`,
    'Bootstrap',
  );
}

function startHealthHttpServer(
  host: string,
  port: number,
  readiness: IamReadinessService,
): ReturnType<typeof createServer> {
  const server = createServer((request, response) => {
    void handleHealthRequest(request, response, readiness);
  });
  server.listen(port, host);
  return server;
}

async function handleHealthRequest(
  request: IncomingMessage,
  response: ServerResponse,
  readiness: IamReadinessService,
): Promise<void> {
  const path = request.url?.split('?')[0] ?? '';
  if (request.method === 'GET' && path === '/health/live') {
    writeJson(response, 200, { status: 'ok' });
    return;
  }
  if (request.method === 'GET' && path === '/health/ready') {
    const postgres = await readiness.pingPostgres();
    const redis = await readiness.pingRedis();
    if (!postgres || !redis) {
      writeJson(response, 503, {
        status: 'error',
        checks: {
          postgres: postgres ? 'up' : 'down',
          redis: redis ? 'up' : 'down',
        },
      });
      return;
    }
    writeJson(response, 200, {
      status: 'ok',
      checks: { postgres: 'up', redis: 'up' },
    });
    return;
  }
  writeJson(response, 404, { status: 'error' });
}

function writeJson(
  response: ServerResponse,
  statusCode: number,
  body: Record<string, unknown>,
): void {
  response.writeHead(statusCode, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

void bootstrap();
