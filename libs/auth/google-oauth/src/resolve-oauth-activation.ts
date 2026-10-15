import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { GOOGLE_OAUTH_REQUEST } from './constants/google-oauth.constants';
import type {
  GoogleOAuthRequest,
  GoogleOAuthStart,
  GoogleOAuthStateStore,
} from './interfaces/google-oauth.interfaces';
import { createGoogleOAuthStart } from './oauth-start';
import { sameCredential } from './same-credential';

export type GoogleOAuthActivation =
  { phase: 'start'; start: GoogleOAuthStart } | { phase: 'callback' };

export function resolveGoogleOAuthActivation(
  request: GoogleOAuthRequest,
  response: Response,
  states: GoogleOAuthStateStore,
  ttlSeconds: number,
): GoogleOAuthActivation {
  const query = queryOf(request);

  if (typeof query.error === 'string' && query.error.length > 0) {
    states.clear(response);
    throw new ForbiddenException();
  }

  const code = query.code;
  if (code === undefined || code.length === 0) {
    const start = createGoogleOAuthStart(ttlSeconds);
    request[GOOGLE_OAUTH_REQUEST.START] = start;
    states.save(request, response, start);
    return { phase: 'start', start };
  }

  const saved = states.consume(request, response);
  const presentedState = query.state;
  if (
    saved === null ||
    presentedState === undefined ||
    presentedState.length === 0 ||
    !sameCredential(saved.state, presentedState)
  ) {
    throw new UnauthorizedException();
  }

  request[GOOGLE_OAUTH_REQUEST.CODE_VERIFIER] = saved.codeVerifier;
  return { phase: 'callback' };
}

function queryOf(request: Request): Record<string, string> {
  const query = request.query;
  if (typeof query !== 'object' || query === null) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') {
      result[key] = value;
    }
  }
  return result;
}
