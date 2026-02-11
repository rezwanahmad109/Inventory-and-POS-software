import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ example: 'inventory', description: 'Module name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  module!: string;

  @ApiProperty({
    example: 'inventory.create',
    description:
      'Action name (create, read, update) or full permission slug (inventory.create)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  action!: string;

  @ApiPropertyOptional({ example: 'Allows creating inventory items', description: 'Permission description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
