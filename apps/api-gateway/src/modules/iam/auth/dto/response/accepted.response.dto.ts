import { ApiProperty } from '@nestjs/swagger';

export class AcceptedResponseDto {
  @ApiProperty({ example: true })
  accepted!: boolean;
}
