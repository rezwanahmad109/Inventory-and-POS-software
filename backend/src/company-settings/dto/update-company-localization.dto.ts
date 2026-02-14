import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateCompanyLocalizationDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  defaultCurrency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timeZone?: string;
}
