import { ApiProperty } from '@nestjs/swagger';
import { PublicUserResponseDto } from './public-user.response.dto';

export class AuthSessionResponseDto {
  @ApiProperty({ type: PublicUserResponseDto })
  user!: PublicUserResponseDto;

  @ApiProperty({
    description: 'JWT access credential. Refresh stays in HttpOnly cookie.',
  })
  accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({ example: 900 })
  expiresInSeconds!: number;
}
