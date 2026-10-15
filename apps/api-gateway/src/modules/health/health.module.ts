import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { IamGrpcHealthIndicator } from './iam-grpc-health.indicator';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [IamGrpcHealthIndicator],
})
export class HealthModule {}
