import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditLog } from '../database/entities/audit-log.entity';
import { BranchEntity } from '../database/entities/branch.entity';
import { PriceTierEntity } from '../database/entities/price-tier.entity';
import { ProductPriceTierEntity } from '../database/entities/product-price-tier.entity';
import { Category, Product, Unit } from '../database/entities/product.entity';
import { StockLedgerEntry } from '../database/entities/stock-ledger.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Category,
      Unit,
      BranchEntity,
      PriceTierEntity,
      ProductPriceTierEntity,
      StockLedgerEntry,
      AuditLog,
    ]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
