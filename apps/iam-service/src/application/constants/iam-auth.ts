export const AUTH_PROVIDER = {
  LOCAL: 'LOCAL',
  GOOGLE: 'GOOGLE',
  HYBRID: 'HYBRID',
} as const;

export type AuthProvider = (typeof AUTH_PROVIDER)[keyof typeof AUTH_PROVIDER];

export const ROLE_CODE = {
  CUSTOMER: 'CUSTOMER',
  STORE_STAFF: 'STORE_STAFF',
  MANAGER: 'MANAGER',
  JEWELER: 'JEWELER',
  DELIVERY_STAFF: 'DELIVERY_STAFF',
  ADMIN: 'ADMIN',
} as const;
