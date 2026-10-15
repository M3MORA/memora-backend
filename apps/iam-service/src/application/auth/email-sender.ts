import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export type EmailTemplate = 'email-verification' | 'password-reset';

export type OutboundEmail = {
  to: string;
  template: EmailTemplate;
  actionUrl: string;
};

export interface EmailSender {
  send(message: OutboundEmail): Promise<void>;
}

@Injectable()
export class UnconfiguredEmailSender implements EmailSender {
  send(_message: OutboundEmail): Promise<void> {
    void _message;
    return Promise.reject(
      new ServiceUnavailableException('Email delivery is unavailable'),
    );
  }
}
