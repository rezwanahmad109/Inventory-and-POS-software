import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BranchesModule } from '../branches/branches.module';
import { Product } from '../database/entities/product.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { PurchaseReturn } from '../database/entities/purchase-return.entity';
import { PurchaseReturnItem } from '../database/entities/purchase-return-item.entity';
import { PurchaseReturnController } from './purchase-return.controller';
import { PurchaseReturnService } from './purchase-return.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseReturn,
      PurchaseReturnItem,
      Purchase,
      Product,
    ]),
    BranchesModule,
  ],
  controllers: [PurchaseReturnController],
  providers: [PurchaseReturnService],
})
export class PurchaseReturnModule {}
