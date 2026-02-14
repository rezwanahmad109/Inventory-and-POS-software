import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PosOrder } from '../database/entities/pos-order.entity';
import { Product } from '../database/entities/product.entity';
import { ProductsModule } from '../products/products.module';
import { SalesModule } from '../sales/sales.module';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PosOrder, Product]),
    ProductsModule,
    SalesModule,
  ],
  controllers: [PosController],
  providers: [PosService],
})
export class PosModule {}
