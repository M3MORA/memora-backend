import { SetMetadata } from '@nestjs/common';
import { AUTHORIZATION_METADATA } from '../constants/authorization.constants';

/**
 * Roles được phép truy cập. Nhiều role = ANY (OR).
 * Decorator chỉ gắn metadata; RolesGuard mới kiểm tra.
 */
export const Roles = (...roles: string[]) =>
  SetMetadata(AUTHORIZATION_METADATA.ROLES, roles);
