import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Product } from '../database/entities/product.entity';
import { ProductsModule } from '../products/products.module';
import { PurchaseItem } from '../database/entities/purchase-item.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { PurchaseController } from './purchase.controller';
import { PurchaseService } from './purchase.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Purchase, PurchaseItem, Product, Supplier]),
    ProductsModule,
  ],
  controllers: [PurchaseController],
  providers: [PurchaseService],
})
export class PurchaseModule {}
