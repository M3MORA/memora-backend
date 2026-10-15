export const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  LOCKED: 'LOCKED',
  DISABLED: 'DISABLED',
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export function isActiveUserStatus(status: string): boolean {
  return status === USER_STATUS.ACTIVE;
}

export const UNVERIFIED_ACCOUNT_POLICY =
  'Unverified accounts may receive access tokens after register/login but must not perform sensitive operations until emailVerifiedAt is set.';

export function hasVerifiedEmail(emailVerifiedAt: Date | null): boolean {
  return emailVerifiedAt !== null;
}
