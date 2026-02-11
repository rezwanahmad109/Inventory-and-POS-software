import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePermissionDto {
  @ApiPropertyOptional({ example: 'inventory', description: 'Module name' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  module?: string;

  @ApiPropertyOptional({ example: 'create', description: 'Action name' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  action?: string;

  @ApiPropertyOptional({
    example: 'Allows creating inventory items',
    description: 'Permission description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
