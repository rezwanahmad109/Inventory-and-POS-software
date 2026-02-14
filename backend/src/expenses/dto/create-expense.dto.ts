import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({ example: 'Office Supplies Purchase' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ example: 'Office Supplies' })
  @IsString()
  @IsNotEmpty()
  category!: string;

  @ApiProperty({ example: 150.50 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ example: 'Bought pens and paper for the office' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://cdn.example.com/receipts/expense-1001.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentUrls?: string[];

  @ApiProperty({ example: 'Cash' })
  @IsString()
  @IsNotEmpty()
  paidBy!: string;

  @ApiProperty({ example: '2023-10-15' })
  @IsDateString()
  date!: string;
}
