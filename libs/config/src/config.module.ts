import { DynamicModule } from '@nestjs/common';
import {
  ConfigFactory,
  ConfigModule as NestConfigModule,
} from '@nestjs/config';

export interface ServiceConfigOptions {
  validate: (config: Record<string, unknown>) => object;
  load: ConfigFactory[];
}

export function createServiceConfigModule(
  options: ServiceConfigOptions,
): Promise<DynamicModule> {
  return NestConfigModule.forRoot({
    isGlobal: true,
    cache: true,
    envFilePath: ['.env'],
    expandVariables: true,
    validate: (config: Record<string, unknown>) =>
      options.validate(config) as Record<string, any>,
    load: options.load,
  });
}
