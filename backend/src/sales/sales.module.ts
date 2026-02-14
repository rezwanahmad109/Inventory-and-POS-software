import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BranchesModule } from '../branches/branches.module';
import { Customer } from '../database/entities/customer.entity';
import { Product } from '../database/entities/product.entity';
import { ProductsModule } from '../products/products.module';
import { SaleItem } from '../database/entities/sale-item.entity';
import { SalePayment } from '../database/entities/sale-payment.entity';
import { Sale } from '../database/entities/sale.entity';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SaleItem,
      SalePayment,
      Product,
      Customer,
    ]),
    ProductsModule,
    BranchesModule,
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
