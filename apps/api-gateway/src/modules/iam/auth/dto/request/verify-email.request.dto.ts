import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyEmailRequestDto {
  @ApiProperty({
    description: 'Email verification credential from the action link',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  verificationCredential!: string;
}
