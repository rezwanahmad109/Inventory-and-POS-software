import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadAttachmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  resourceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  resourceId?: string;
}
