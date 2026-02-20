import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token issued at login/refresh.',
    minLength: 20,
  })
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}
