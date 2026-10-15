import { SetMetadata } from '@nestjs/common';
import { AUTH_METADATA } from '../constants/auth-metadata.constants';

/** Đánh dấu endpoint không yêu cầu authentication. Không tự bỏ qua authorization khác. */
export const Public = () => SetMetadata(AUTH_METADATA.PUBLIC, true);
