import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BranchesModule } from '../branches/branches.module';
import { Product } from '../database/entities/product.entity';
import { ProductsModule } from '../products/products.module';
import { PurchaseItem } from '../database/entities/purchase-item.entity';
import { PurchasePayment } from '../database/entities/purchase-payment.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { PurchaseController } from './purchase.controller';
import { PurchaseService } from './purchase.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Purchase,
      PurchaseItem,
      PurchasePayment,
      Product,
      Supplier,
    ]),
    ProductsModule,
    BranchesModule,
  ],
  controllers: [PurchaseController],
  providers: [PurchaseService],
  exports: [PurchaseService],
})
export class PurchaseModule {}
