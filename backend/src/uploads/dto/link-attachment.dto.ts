import { IsString, MaxLength } from 'class-validator';

export class LinkAttachmentDto {
  @IsString()
  @MaxLength(40)
  resourceType!: string;

  @IsString()
  @MaxLength(80)
  resourceId!: string;
}
