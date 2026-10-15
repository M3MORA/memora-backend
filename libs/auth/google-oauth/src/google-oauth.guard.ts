import {
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import {
  GOOGLE_OAUTH_OPTIONS,
  GOOGLE_OAUTH_REQUEST,
  GOOGLE_OAUTH_SCOPES,
  GOOGLE_OAUTH_STATE_STORE,
  GOOGLE_OAUTH_STRATEGY,
} from './constants/google-oauth.constants';
import type {
  GoogleOAuthModuleOptions,
  GoogleOAuthRequest,
  GoogleOAuthStart,
  GoogleOAuthStateStore,
} from './interfaces/google-oauth.interfaces';
import { resolveGoogleOAuthActivation } from './resolve-oauth-activation';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard(GOOGLE_OAUTH_STRATEGY) {
  constructor(
    @Inject(GOOGLE_OAUTH_OPTIONS)
    private readonly options: GoogleOAuthModuleOptions,
    @Inject(GOOGLE_OAUTH_STATE_STORE)
    private readonly states: GoogleOAuthStateStore,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.options.enabled) {
      throw new UnauthorizedException('Google sign-in is unavailable');
    }

    const request = context.switchToHttp().getRequest<GoogleOAuthRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    resolveGoogleOAuthActivation(
      request,
      response,
      this.states,
      this.options.stateTtlSeconds,
    );
    return (await super.canActivate(context)) as boolean;
  }

  getAuthenticateOptions(context: ExecutionContext): {
    session: false;
    state?: string;
    scope: string[];
    codeChallenge?: string;
    codeVerifier?: string;
  } {
    const request = context.switchToHttp().getRequest<GoogleOAuthRequest>();
    const start = request[GOOGLE_OAUTH_REQUEST.START];
    const verifier = request[GOOGLE_OAUTH_REQUEST.CODE_VERIFIER];
    return {
      session: false,
      scope: [...GOOGLE_OAUTH_SCOPES],
      ...(isStart(start)
        ? { state: start.state, codeChallenge: start.codeChallenge }
        : {}),
      ...(typeof verifier === 'string' && verifier.length > 0
        ? { codeVerifier: verifier }
        : {}),
    };
  }
}

function isStart(value: unknown): value is GoogleOAuthStart {
  return (
    typeof value === 'object' &&
    value !== null &&
    'state' in value &&
    typeof value.state === 'string'
  );
}
