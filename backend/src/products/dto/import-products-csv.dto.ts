import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ImportProductsCsvDto {
  @ApiProperty({
    description: 'CSV payload including header row',
    example: 'name,sku,barcode,categoryId,unitId,price,stockQty\nScanner,SKU1,123,uuid1,uuid2,25.5,10',
  })
  @IsString()
  @IsNotEmpty()
  csvContent!: string;
}
