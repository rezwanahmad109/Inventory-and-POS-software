import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { BranchEntity } from '../database/entities/branch.entity';
import { BranchProductEntity } from '../database/entities/branch-product.entity';
import { Product } from '../database/entities/product.entity';
import { StockTransferEntity } from '../database/entities/stock-transfer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BranchEntity,
      BranchProductEntity,
      Product,
      StockTransferEntity,
    ]),
  ],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
