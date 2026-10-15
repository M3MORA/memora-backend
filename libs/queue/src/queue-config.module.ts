import {
  type DynamicModule,
  type InjectionToken,
  Module,
} from '@nestjs/common';
import {
  QUEUE_BULLMQ_SHARED_OPTIONS,
  QUEUE_REDIS_CONNECTION_OPTIONS,
} from './queue.constants';
import type { QueueRedisModuleOptions } from './queue.interfaces';
import {
  createBullMqSharedOptions,
  createQueueRedisConnectionOptions,
} from './queue-options';

const QUEUE_REDIS_MODULE_OPTIONS = 'QUEUE_REDIS_MODULE_OPTIONS';

@Module({})
export class QueueConfigModule {
  static forRoot(options: QueueRedisModuleOptions): DynamicModule {
    return QueueConfigModule.build(options);
  }

  static forRootAsync(options: {
    imports?: DynamicModule['imports'];
    inject?: InjectionToken[];
    useFactory: (
      ...args: unknown[]
    ) => QueueRedisModuleOptions | Promise<QueueRedisModuleOptions>;
  }): DynamicModule {
    return {
      module: QueueConfigModule,
      imports: [...(options.imports ?? [])],
      providers: [
        {
          provide: QUEUE_REDIS_MODULE_OPTIONS,
          inject: options.inject ?? [],
          useFactory: options.useFactory,
        },
        {
          provide: QUEUE_REDIS_CONNECTION_OPTIONS,
          inject: [QUEUE_REDIS_MODULE_OPTIONS],
          useFactory: (resolved: QueueRedisModuleOptions) =>
            createQueueRedisConnectionOptions(resolved),
        },
        {
          provide: QUEUE_BULLMQ_SHARED_OPTIONS,
          inject: [QUEUE_REDIS_MODULE_OPTIONS],
          useFactory: (resolved: QueueRedisModuleOptions) =>
            createBullMqSharedOptions(resolved),
        },
      ],
      exports: [QUEUE_REDIS_CONNECTION_OPTIONS, QUEUE_BULLMQ_SHARED_OPTIONS],
    };
  }

  private static build(options: QueueRedisModuleOptions): DynamicModule {
    return {
      module: QueueConfigModule,
      providers: [
        {
          provide: QUEUE_REDIS_CONNECTION_OPTIONS,
          useValue: createQueueRedisConnectionOptions(options),
        },
        {
          provide: QUEUE_BULLMQ_SHARED_OPTIONS,
          useValue: createBullMqSharedOptions(options),
        },
      ],
      exports: [QUEUE_REDIS_CONNECTION_OPTIONS, QUEUE_BULLMQ_SHARED_OPTIONS],
    };
  }
}
