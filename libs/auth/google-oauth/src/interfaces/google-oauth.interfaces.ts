import type { Request, Response } from 'express';

export type GoogleOAuthStart = {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  expiresAtMs: number;
};

export type VerifiedGoogleOAuthIdentity = {
  idToken: string;
};

export interface GoogleOAuthStateStore {
  save(request: Request, response: Response, start: GoogleOAuthStart): void;
  consume(request: Request, response: Response): GoogleOAuthStart | null;
  clear(response: Response): void;
}

export type GoogleOAuthModuleOptions = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  stateTtlSeconds: number;
  stateStore?: GoogleOAuthStateStore;
};

export type GoogleOAuthRequest = Request & {
  [key: string]: unknown;
  user?: VerifiedGoogleOAuthIdentity;
};
