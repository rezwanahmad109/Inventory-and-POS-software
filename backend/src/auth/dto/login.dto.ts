import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@inventory.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 6, example: 'ChangeMe123!' })
  @IsString()
  @MinLength(6)
  password!: string;
}
