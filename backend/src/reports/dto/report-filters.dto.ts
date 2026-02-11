import { IsOptional, IsString } from 'class-validator';

export class ReportFiltersDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  supplier?: string;
}