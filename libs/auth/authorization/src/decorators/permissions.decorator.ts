import { SetMetadata } from '@nestjs/common';
import { AUTHORIZATION_METADATA } from '../constants/authorization.constants';

/**
 * Permissions bắt buộc. Nhiều permission = ALL (AND).
 * Decorator chỉ gắn metadata; PermissionsGuard mới kiểm tra.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(AUTHORIZATION_METADATA.PERMISSIONS, permissions);
