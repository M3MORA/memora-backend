import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class GatewayThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    return Promise.resolve(clientIpOf(req));
  }
}

function clientIpOf(req: Record<string, unknown>): string {
  if (typeof req.ip === 'string' && req.ip.length > 0) {
    return req.ip;
  }
  return 'unknown';
}
