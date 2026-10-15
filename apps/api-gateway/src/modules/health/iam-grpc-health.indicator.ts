import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import {
  credentials,
  loadPackageDefinition,
  status as GrpcStatus,
  type ServiceError,
} from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { join } from 'node:path';

const HEALTH_DEADLINE_MS = 2000;
const SERVING = 1;

interface HealthCheckClient {
  Check(
    request: { service: string },
    options: { deadline: Date },
    callback: (
      error: ServiceError | null,
      response: { status?: number } | undefined,
    ) => void,
  ): void;
  close(): void;
}

interface HealthPackage {
  grpc: {
    health: {
      v1: {
        Health: new (
          address: string,
          creds: ReturnType<typeof credentials.createInsecure>,
        ) => HealthCheckClient;
      };
    };
  };
}

@Injectable()
export class IamGrpcHealthIndicator extends HealthIndicator {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const url = this.configService.getOrThrow<string>('apiGateway.iamGrpcUrl');
    try {
      const serving = await checkIamServing(url);
      if (!serving) {
        throw new Error('not serving');
      }
      return this.getStatus(key, true);
    } catch {
      const result = this.getStatus(key, false);
      throw new HealthCheckError('IAM gRPC is not ready', result);
    }
  }
}

function checkIamServing(url: string): Promise<boolean> {
  const client = createHealthClient(url);
  return new Promise((resolve, reject) => {
    client.Check(
      { service: '' },
      { deadline: new Date(Date.now() + HEALTH_DEADLINE_MS) },
      (error, response) => {
        client.close();
        if (error !== null) {
          if (error.code === GrpcStatus.DEADLINE_EXCEEDED) {
            reject(error);
            return;
          }
          reject(error);
          return;
        }
        resolve(response?.status === SERVING);
      },
    );
  });
}

function createHealthClient(url: string): HealthCheckClient {
  const definition = loadSync(
    join(process.cwd(), 'proto/grpc/health/v1/health.proto'),
    {
      keepCase: false,
      longs: String,
      defaults: true,
      oneofs: true,
    },
  );
  const proto = loadPackageDefinition(definition) as unknown as HealthPackage;
  return new proto.grpc.health.v1.Health(url, credentials.createInsecure());
}
