import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../repositories/user.repository';
import {
  toPublicUser,
  toUserAuthRecord,
  type PublicUser,
  type UserAuthRecord,
} from './users.mapper';

@Injectable()
export class UsersService {
  constructor(private readonly users: UserRepository) {}

  async findById(id: string): Promise<PublicUser | null> {
    const user = await this.users.findById(id);
    return user === null ? null : toPublicUser(user);
  }

  async findByEmail(email: string): Promise<PublicUser | null> {
    const user = await this.users.findByEmail(email);
    return user === null ? null : toPublicUser(user);
  }

  async findAuthByEmail(email: string): Promise<UserAuthRecord | null> {
    const user = await this.users.findByEmail(email);
    return user === null ? null : toUserAuthRecord(user);
  }

  async findAuthByGoogleSub(googleSub: string): Promise<UserAuthRecord | null> {
    const user = await this.users.findByGoogleSub(googleSub);
    return user === null ? null : toUserAuthRecord(user);
  }
}
