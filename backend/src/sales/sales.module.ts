import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BranchesModule } from '../branches/branches.module';
import { Customer } from '../database/entities/customer.entity';
import { Product } from '../database/entities/product.entity';
import { SaleDeliveryItem } from '../database/entities/sale-delivery-item.entity';
import { SaleDelivery } from '../database/entities/sale-delivery.entity';
import { Setting } from '../database/entities/setting.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { SaleItem } from '../database/entities/sale-item.entity';
import { SalePayment } from '../database/entities/sale-payment.entity';
import { Sale } from '../database/entities/sale.entity';
import { SalesController } from './sales.controller';
import { SalesPdfService } from './sales-pdf.service';
import { SalesService } from './sales.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SaleItem,
      SalePayment,
      SaleDelivery,
      SaleDeliveryItem,
      Product,
      Customer,
      Setting,
    ]),
    BranchesModule,
    NotificationsModule,
  ],
  controllers: [SalesController],
  providers: [SalesService, SalesPdfService],
  exports: [SalesService],
})
export class SalesModule {}
