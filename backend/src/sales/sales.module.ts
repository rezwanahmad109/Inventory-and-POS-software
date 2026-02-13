import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BranchesModule } from '../branches/branches.module';
import { Product } from '../database/entities/product.entity';
import { ProductsModule } from '../products/products.module';
import { SaleItem } from '../database/entities/sale-item.entity';
import { Sale } from '../database/entities/sale.entity';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, SaleItem, Product]),
    ProductsModule,
    BranchesModule,
  ],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
