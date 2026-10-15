import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicUserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  fullName!: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiProperty()
  authProvider!: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  emailVerifiedAt?: string;

  @ApiPropertyOptional()
  lastLoginAt?: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
