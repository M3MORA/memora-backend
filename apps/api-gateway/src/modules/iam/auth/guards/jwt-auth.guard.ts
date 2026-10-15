import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_METADATA } from '@app/common';
import type { Request } from 'express';
import { IamGrpcClient } from '../../clients/iam-grpc.client';
import type { GatewayAuthenticatedPrincipal } from '../gateway-principal';

interface RequestWithPrincipal extends Request {
  user?: GatewayAuthenticatedPrincipal;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly iam: IamGrpcClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(
      AUTH_METADATA.PUBLIC,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const accessCredential = readBearerCredential(request);
    const principal = await this.iam.validateAccessToken(accessCredential);
    request.user = {
      userId: principal.userId,
      accessCredential,
      emailVerified: principal.emailVerified,
      tokenId: principal.tokenId,
    };
    return true;
  }
}

function readBearerCredential(request: Request): string {
  const header = request.headers.authorization;
  if (header === undefined || !header.startsWith('Bearer ')) {
    throw new UnauthorizedException();
  }
  const credential = header.slice('Bearer '.length).trim();
  if (credential.length === 0) {
    throw new UnauthorizedException();
  }
  return credential;
}
