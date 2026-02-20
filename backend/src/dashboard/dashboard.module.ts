import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BranchProductEntity } from '../database/entities/branch-product.entity';
import { Sale } from '../database/entities/sale.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { Expense } from '../database/entities/expense.entity';
import { Product } from '../database/entities/product.entity';
import { PurchasePayment } from '../database/entities/purchase-payment.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { SalePayment } from '../database/entities/sale-payment.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ttl: Number(
          configService.get<string>('DASHBOARD_CACHE_TTL_SECONDS', '30'),
        ),
        max: 100,
      }),
    }),
    TypeOrmModule.forFeature([
      Sale,
      Purchase,
      Expense,
      Product,
      BranchProductEntity,
      SaleItem,
      SalePayment,
      PurchasePayment,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
