import { Injectable } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthenticatedPrincipal, PrincipalResolver } from '@app/auth';
import type { Request } from 'express';

interface RequestWithPrincipal extends Request {
  user?: AuthenticatedPrincipal;
}

@Injectable()
export class HttpPrincipalResolver implements PrincipalResolver {
  resolve(context: ExecutionContext): AuthenticatedPrincipal | null {
    if (context.getType() !== 'http') {
      return null;
    }
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    return request.user ?? null;
  }
}
