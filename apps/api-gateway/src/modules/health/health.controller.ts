import { Controller, Get, HttpCode } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { Public, SkipResponseTransform } from '@app/common';
import { IamGrpcHealthIndicator } from './iam-grpc-health.indicator';

@ApiExcludeController()
@SkipThrottle()
@SkipResponseTransform()
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly iam: IamGrpcHealthIndicator,
  ) {}

  @Get('live')
  @HttpCode(200)
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([() => this.iam.isHealthy('iam')]);
  }
}
