import { Controller, NotFoundException, UseGuards } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type {
  GetCurrentUserRequest,
  GetUserByIdRequest,
  UserResponse,
} from '@app/contracts';
import { AuthenticationService } from '../../application/auth/authentication.service';
import { UsersService } from '../../application/users/users.service';
import { requireCredential, requireUserId } from './grpc-request';
import { InternalGrpcAuthGuard } from './internal-grpc-auth.guard';
import { toPublicUserMessage } from './mappers/user.grpc.mapper';

@Controller()
@UseGuards(InternalGrpcAuthGuard)
export class AccountGrpcController {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly users: UsersService,
  ) {}

  @GrpcMethod('IamService', 'GetCurrentUser')
  async getCurrentUser(request: GetCurrentUserRequest): Promise<UserResponse> {
    const principal = await this.authentication.verifyAccessToken(
      requireCredential(request.accessCredential),
    );
    return { user: toPublicUserMessage(principal.user) };
  }

  @GrpcMethod('IamService', 'GetUserById')
  async getUserById(request: GetUserByIdRequest): Promise<UserResponse> {
    const user = await this.users.findById(requireUserId(request.userId));
    if (user === null) {
      throw new NotFoundException('User not found');
    }
    return { user: toPublicUserMessage(user) };
  }
}
