import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEmailTemplateDto {
  @IsString()
  @MaxLength(80)
  key!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  subjectTemplate!: string;

  @IsString()
  bodyTemplate!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
