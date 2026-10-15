import { BadRequestException } from '@nestjs/common';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_SECRET_LENGTH = 8;
const MAX_SECRET_LENGTH = 128;

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new BadRequestException('Email is invalid');
  }
  return normalized;
}

export function assertValidPassword(password: string): void {
  if (
    password.length < MIN_SECRET_LENGTH ||
    password.length > MAX_SECRET_LENGTH
  ) {
    throw new BadRequestException('Credentials do not meet requirements');
  }
}
