import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Sale } from '../database/entities/sale.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { Expense } from '../database/entities/expense.entity';
import { BranchProductEntity } from '../database/entities/branch-product.entity';
import { Product } from '../database/entities/product.entity';

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
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
