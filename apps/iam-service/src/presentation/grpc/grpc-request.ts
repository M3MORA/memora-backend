import { BadRequestException } from '@nestjs/common';

const MAX_CREDENTIAL_LENGTH = 4096;
const MAX_ID_TOKEN_LENGTH = 8192;
const MAX_CODE_LENGTH = 80;
const MAX_CODES = 32;
const USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireText(
  value: string | undefined,
  field: string,
  maxLength: number,
): string {
  if (value === undefined || value.trim() === '') {
    throw new BadRequestException(`${field} is required`);
  }
  if (value.length > maxLength) {
    throw new BadRequestException(`${field} is invalid`);
  }
  return value;
}

export function requireCredential(value: string | undefined): string {
  return requireText(value, 'Credential', MAX_CREDENTIAL_LENGTH);
}

export function requireGoogleIdToken(value: string | undefined): string {
  return requireText(value, 'Google credential', MAX_ID_TOKEN_LENGTH);
}

export function requireUserId(value: string | undefined): string {
  const userId = requireText(value, 'User id', 36);
  if (!USER_ID_PATTERN.test(userId)) {
    throw new BadRequestException('User id is invalid');
  }
  return userId;
}

export function requireCodes(values: string[] | undefined): string[] {
  if (values === undefined || values.length === 0) {
    throw new BadRequestException('At least one code is required');
  }
  if (values.length > MAX_CODES) {
    throw new BadRequestException('Too many codes');
  }
  return values.map((value) => requireText(value, 'Code', MAX_CODE_LENGTH));
}
