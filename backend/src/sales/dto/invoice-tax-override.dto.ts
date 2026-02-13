import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, Min } from 'class-validator';

import { TaxMethod } from '../../common/enums/tax-method.enum';

export class InvoiceTaxOverrideDto {
  @ApiProperty({ example: 7.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rate!: number;

  @ApiProperty({ enum: TaxMethod })
  @IsEnum(TaxMethod)
  method!: TaxMethod;
}
