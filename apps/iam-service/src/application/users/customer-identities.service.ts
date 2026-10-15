import { Injectable } from '@nestjs/common';
import type { CustomerIdentity } from '../../../generated/prisma/client';
import { CustomerIdentityRepository } from '../../repositories/customer-identity.repository';

@Injectable()
export class CustomerIdentitiesService {
  constructor(private readonly identities: CustomerIdentityRepository) {}

  findById(id: string): Promise<CustomerIdentity | null> {
    return this.identities.findById(id);
  }

  findLinkedByUserId(userId: string): Promise<CustomerIdentity[]> {
    return this.identities.findByUserId(userId);
  }

  findPrimaryByUserId(userId: string): Promise<CustomerIdentity | null> {
    return this.identities.findPrimaryByUserId(userId);
  }
}
