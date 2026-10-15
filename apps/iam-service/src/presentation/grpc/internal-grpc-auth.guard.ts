import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INTERNAL_GRPC_AUTH_METADATA_KEY } from '@app/common';
import { Metadata } from '@grpc/grpc-js';
import { createHash, timingSafeEqual } from 'node:crypto';

@Injectable()
export class InternalGrpcAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.getOrThrow<string>('iam.internalGrpcSecret');
    const provided = readInternalCredential(context);
    if (provided === undefined || !credentialsMatch(provided, expected)) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return true;
  }
}

function readInternalCredential(context: ExecutionContext): string | undefined {
  const metadata = resolveMetadata(context);
  if (metadata === undefined) {
    return undefined;
  }
  const values = metadata.get(INTERNAL_GRPC_AUTH_METADATA_KEY);
  const first = values[0];
  if (typeof first === 'string' && first.length > 0) {
    return first;
  }
  if (Buffer.isBuffer(first) && first.length > 0) {
    return first.toString('utf8');
  }
  return undefined;
}

function resolveMetadata(context: ExecutionContext): Metadata | undefined {
  const rpcContext = context.switchToRpc().getContext<unknown>();
  if (rpcContext instanceof Metadata) {
    return rpcContext;
  }
  const args: unknown[] = context.getArgs();
  const maybeMetadata = args[1];
  if (maybeMetadata instanceof Metadata) {
    return maybeMetadata;
  }
  return undefined;
}

function credentialsMatch(provided: string, expected: string): boolean {
  const providedDigest = createHash('sha256').update(provided).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}
