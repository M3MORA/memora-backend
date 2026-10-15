import { SetMetadata } from '@nestjs/common';

export const RESPONSE_TRANSFORM_METADATA = {
  SKIP: 'response:skipTransform',
  MESSAGE: 'response:successMessage',
} as const;

/** Bỏ qua JSON success wrapper. Dùng cho file, redirect, raw Express Response. */
export const SkipResponseTransform = () =>
  SetMetadata(RESPONSE_TRANSFORM_METADATA.SKIP, true);

/** Message success tùy chọn. Không thay status code. */
export const SuccessMessage = (message: string) =>
  SetMetadata(RESPONSE_TRANSFORM_METADATA.MESSAGE, message);
