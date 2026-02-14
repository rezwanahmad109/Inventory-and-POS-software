import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BranchesModule } from '../branches/branches.module';
import { Customer } from '../database/entities/customer.entity';
import { Product } from '../database/entities/product.entity';
import { Sale } from '../database/entities/sale.entity';
import { SalesReturnPayment } from '../database/entities/sales-return-payment.entity';
import { SalesReturn } from '../database/entities/sales-return.entity';
import { SalesReturnItem } from '../database/entities/sales-return-item.entity';
import { SalesReturnController } from './sales-return.controller';
import { SalesReturnService } from './sales-return.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalesReturn,
      SalesReturnItem,
      SalesReturnPayment,
      Sale,
      Product,
      Customer,
    ]),
    BranchesModule,
  ],
  controllers: [SalesReturnController],
  providers: [SalesReturnService],
})
export class SalesReturnModule {}
