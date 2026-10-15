import { ApiProperty } from '@nestjs/swagger';

export class CsrfTokenResponseDto {
  @ApiProperty()
  csrfToken!: string;
}
