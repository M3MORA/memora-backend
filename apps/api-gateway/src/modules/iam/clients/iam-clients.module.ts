import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'node:path';
import { IAM_GRPC_CLIENT, IamGrpcClient } from './iam-grpc.client';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: IAM_GRPC_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            url: configService.getOrThrow<string>('apiGateway.iamGrpcUrl'),
            package: 'memora.iam.v1',
            protoPath: join(process.cwd(), 'proto/iam/v1/iam.proto'),
            loader: {
              includeDirs: [join(process.cwd(), 'proto')],
              longs: String,
              keepCase: false,
            },
          },
        }),
      },
    ]),
  ],
  providers: [IamGrpcClient],
  exports: [IamGrpcClient],
})
export class IamClientsModule {}
