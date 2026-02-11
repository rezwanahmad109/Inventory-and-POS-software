import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class AssignRolesDto {
  @IsArray({ message: 'roleIds must be an array' })
  @ArrayMinSize(1, { message: 'roleIds array must contain at least one role' })
  @ArrayUnique({ message: 'roleIds must not contain duplicates' })
  @IsUUID('4', { each: true, message: 'Each roleId must be a valid UUID' })
  roleIds!: string[];

  @IsOptional()
  @IsString({ message: 'reason must be a string' })
  reason?: string;
}
