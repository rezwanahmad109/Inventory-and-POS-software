import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ImportUserRowDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(6)
  @MaxLength(120)
  password!: string;

  @ApiProperty({ format: 'uuid', description: 'Primary role ID' })
  @IsUUID('4')
  roleId!: string;
}

export class ImportUsersDto {
  @ApiProperty({ type: [ImportUserRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportUserRowDto)
  users!: ImportUserRowDto[];

  @ApiPropertyOptional({
    description: 'Skip duplicate emails instead of failing the whole import',
    default: true,
  })
  @IsOptional()
  skipDuplicates?: boolean;
}
