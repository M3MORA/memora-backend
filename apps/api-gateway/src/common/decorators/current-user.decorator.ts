import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '@app/auth';

interface HttpRequestWithPrincipal {
  user?: AuthenticatedPrincipal;
}

/**
 * Đọc principal mà Authentication Guard đã gắn vào `request.user`.
 * Không decode JWT, không đọc body/query, không gọi IAM.
 * Request chưa có `user` thì trả về `undefined`.
 */
export const CurrentUser = createParamDecorator(
  (
    property: keyof AuthenticatedPrincipal | undefined,
    context: ExecutionContext,
  ):
    | AuthenticatedPrincipal
    | AuthenticatedPrincipal[keyof AuthenticatedPrincipal]
    | undefined => {
    const request = context
      .switchToHttp()
      .getRequest<HttpRequestWithPrincipal>();
    const principal = request.user;

    if (principal === undefined) {
      return undefined;
    }

    if (property === undefined) {
      return principal;
    }

    return principal[property];
  },
);
