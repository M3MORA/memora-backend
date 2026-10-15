import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

@Catch(HttpException)
@Injectable()
export class GoogleOAuthRedirectFilter implements ExceptionFilter {
  private readonly logger = new Logger(GoogleOAuthRedirectFilter.name);

  constructor(private readonly config: ConfigService) {}

  catch(exception: HttpException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception.getStatus();
    this.logger.warn(
      `Google OAuth callback failed status=${status} reason=${oauthFailureReason(exception)}`,
    );
    const failureUrl = this.config.get<string>(
      'apiGateway.frontendAuthFailureUrl',
    );
    if (typeof failureUrl !== 'string' || failureUrl.length === 0) {
      response.status(status).json(exception.getResponse());
      return;
    }
    response.redirect(302, failureUrl);
  }
}

function oauthFailureReason(exception: HttpException): string {
  const body = exception.getResponse();
  if (typeof body === 'string' && body.length > 0) {
    return body;
  }
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const message = body.message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return exception.message;
}
