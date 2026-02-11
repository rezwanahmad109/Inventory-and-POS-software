import { IsDateString, IsNotEmpty } from 'class-validator';

export class DateRangeDto {
  @IsDateString()
  @IsNotEmpty()
  from!: string;

  @IsDateString()
  @IsNotEmpty()
  to!: string;
}