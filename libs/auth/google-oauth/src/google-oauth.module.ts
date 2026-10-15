import {
  type DynamicModule,
  type InjectionToken,
  Module,
} from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import {
  GOOGLE_OAUTH_OPTIONS,
  GOOGLE_OAUTH_STATE_STORE,
} from './constants/google-oauth.constants';
import { GoogleOAuthGuard } from './google-oauth.guard';
import { GoogleStrategy } from './google.strategy';
import type {
  GoogleOAuthModuleOptions,
  GoogleOAuthStateStore,
} from './interfaces/google-oauth.interfaces';

@Module({})
export class GoogleOAuthModule {
  static forRoot(options: GoogleOAuthModuleOptions): DynamicModule {
    return GoogleOAuthModule.build(options);
  }

  static forRootAsync(options: {
    imports?: DynamicModule['imports'];
    inject?: InjectionToken[];
    useFactory: (
      ...args: unknown[]
    ) => GoogleOAuthModuleOptions | Promise<GoogleOAuthModuleOptions>;
  }): DynamicModule {
    return {
      module: GoogleOAuthModule,
      imports: [...(options.imports ?? []), PassportModule.register({})],
      providers: [
        {
          provide: GOOGLE_OAUTH_OPTIONS,
          inject: options.inject ?? [],
          useFactory: options.useFactory,
        },
        {
          provide: GOOGLE_OAUTH_STATE_STORE,
          inject: [GOOGLE_OAUTH_OPTIONS],
          useFactory: (
            config: GoogleOAuthModuleOptions,
          ): GoogleOAuthStateStore => {
            if (!config.enabled) {
              return noopStateStore();
            }
            if (config.stateStore === undefined) {
              throw new Error(
                'GoogleOAuthModule requires a stateStore when OAuth is enabled',
              );
            }
            return config.stateStore;
          },
        },
        GoogleStrategy,
        GoogleOAuthGuard,
      ],
      exports: [
        GoogleOAuthGuard,
        GOOGLE_OAUTH_OPTIONS,
        GOOGLE_OAUTH_STATE_STORE,
      ],
    };
  }

  private static build(options: GoogleOAuthModuleOptions): DynamicModule {
    if (!options.enabled) {
      return {
        module: GoogleOAuthModule,
        providers: [
          {
            provide: GOOGLE_OAUTH_OPTIONS,
            useValue: options,
          },
        ],
        exports: [GOOGLE_OAUTH_OPTIONS],
      };
    }

    if (options.stateStore === undefined) {
      throw new Error(
        'GoogleOAuthModule requires a stateStore when OAuth is enabled',
      );
    }

    return {
      module: GoogleOAuthModule,
      imports: [PassportModule.register({})],
      providers: [
        {
          provide: GOOGLE_OAUTH_OPTIONS,
          useValue: options,
        },
        {
          provide: GOOGLE_OAUTH_STATE_STORE,
          useValue: options.stateStore,
        },
        GoogleStrategy,
        GoogleOAuthGuard,
      ],
      exports: [
        GoogleOAuthGuard,
        GOOGLE_OAUTH_OPTIONS,
        GOOGLE_OAUTH_STATE_STORE,
      ],
    };
  }
}

function noopStateStore(): GoogleOAuthStateStore {
  return {
    save: () => undefined,
    consume: () => null,
    clear: () => undefined,
  };
}
