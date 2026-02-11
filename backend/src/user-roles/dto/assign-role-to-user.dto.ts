import { IsUUID, IsOptional, IsString } from 'class-validator';

export class AssignRoleToUserDto {
  @IsUUID('4', { message: 'roleId must be a valid UUID' })
  roleId!: string;

  @IsOptional()
  @IsString({ message: 'reason must be a string' })
  reason?: string;
}
