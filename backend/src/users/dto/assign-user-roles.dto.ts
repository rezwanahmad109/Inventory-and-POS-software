import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, IsOptional, IsUUID } from 'class-validator';

export class AssignUserRolesDto {
  @ApiProperty({
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      '660e8400-e29b-41d4-a716-446655440001',
    ],
    description: 'Role IDs to assign to the user (replaces existing assignments)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  roleIds!: string[];

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Optional primary role ID. Must be one of roleIds if provided',
  })
  @IsOptional()
  @IsUUID('4')
  primaryRoleId?: string;
}
