import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TaxEntity } from '../database/entities/tax.entity';
import { TaxesController } from './taxes.controller';
import { TaxesService } from './taxes.service';

@Module({
  imports: [TypeOrmModule.forFeature([TaxEntity])],
  controllers: [TaxesController],
  providers: [TaxesService],
})
export class TaxesModule {}
