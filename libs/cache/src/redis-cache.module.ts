import {
  type DynamicModule,
  type InjectionToken,
  Module,
} from '@nestjs/common';
import { REDIS_CACHE_OPTIONS } from './redis-cache.constants';
import type { RedisCacheModuleOptions } from './redis-cache.interfaces';
import { RedisCacheService } from './redis-cache.service';
import { assertCacheNamespace } from './cache-key';

@Module({})
export class RedisCacheModule {
  static forRoot(options: RedisCacheModuleOptions): DynamicModule {
    return RedisCacheModule.build(options);
  }

  static forRootAsync(options: {
    imports?: DynamicModule['imports'];
    inject?: InjectionToken[];
    useFactory: (
      ...args: unknown[]
    ) => RedisCacheModuleOptions | Promise<RedisCacheModuleOptions>;
  }): DynamicModule {
    return {
      module: RedisCacheModule,
      imports: [...(options.imports ?? [])],
      providers: [
        {
          provide: REDIS_CACHE_OPTIONS,
          inject: options.inject ?? [],
          useFactory: async (
            ...args: unknown[]
          ): Promise<RedisCacheModuleOptions> => {
            const resolved = await options.useFactory(...args);
            return withValidatedNamespace(resolved);
          },
        },
        RedisCacheService,
      ],
      exports: [RedisCacheService],
    };
  }

  private static build(options: RedisCacheModuleOptions): DynamicModule {
    return {
      module: RedisCacheModule,
      providers: [
        {
          provide: REDIS_CACHE_OPTIONS,
          useValue: withValidatedNamespace(options),
        },
        RedisCacheService,
      ],
      exports: [RedisCacheService],
    };
  }
}

function withValidatedNamespace(
  options: RedisCacheModuleOptions,
): RedisCacheModuleOptions {
  return {
    ...options,
    namespace: assertCacheNamespace(options.namespace),
  };
}
