import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateCompanyBrandingDto {
  @IsOptional()
  @IsUrl()
  @MaxLength(1000)
  primaryLogoUrl?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(1000)
  secondaryLogoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  theme?: string;
}
