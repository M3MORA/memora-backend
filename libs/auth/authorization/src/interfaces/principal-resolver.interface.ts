import type { ExecutionContext } from '@nestjs/common';
import type { AuthenticatedPrincipal } from './authenticated-principal.interface';

/**
 * Trích principal đã xác thực từ HTTP hoặc gRPC.
 * Implementation thuộc từng application, không nằm trong shared library.
 */
export interface PrincipalResolver {
  resolve(
    context: ExecutionContext,
  ): AuthenticatedPrincipal | null | Promise<AuthenticatedPrincipal | null>;
}
