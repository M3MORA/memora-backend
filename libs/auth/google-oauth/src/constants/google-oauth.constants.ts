export const GOOGLE_OAUTH_STRATEGY = 'google';

export const GOOGLE_OAUTH_OPTIONS = 'GOOGLE_OAUTH_OPTIONS';

export const GOOGLE_OAUTH_STATE_STORE = 'GOOGLE_OAUTH_STATE_STORE';

export const GOOGLE_OAUTH_SCOPES = ['openid', 'email', 'profile'] as const;

export const GOOGLE_OAUTH_REQUEST = {
  START: 'memoraGoogleOAuthStart',
  CODE_VERIFIER: 'memoraGoogleOAuthCodeVerifier',
} as const;
