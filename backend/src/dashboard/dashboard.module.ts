import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BranchProductEntity } from '../database/entities/branch-product.entity';
import { Sale } from '../database/entities/sale.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { Expense } from '../database/entities/expense.entity';
import { Product } from '../database/entities/product.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      Purchase,
      Expense,
      Product,
      BranchProductEntity,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
