import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { CategoriesModule } from './categories/categories.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { BranchEntity } from './database/entities/branch.entity';
import { BranchProductEntity } from './database/entities/branch-product.entity';
import { Customer } from './database/entities/customer.entity';
import { Expense } from './database/entities/expense.entity';
import { Payment } from './database/entities/payment.entity';
import { Permission } from './database/entities/permission.entity';
import { Category, Product, Unit } from './database/entities/product.entity';
import { PurchaseItem } from './database/entities/purchase-item.entity';
import { PurchaseReturn } from './database/entities/purchase-return.entity';
import { PurchaseReturnItem } from './database/entities/purchase-return-item.entity';
import { Purchase } from './database/entities/purchase.entity';
import { Role } from './database/entities/role.entity';
import { RolePermission } from './database/entities/role-permission.entity';
import { SaleItem } from './database/entities/sale-item.entity';
import { Sale } from './database/entities/sale.entity';
import { SalesReturn } from './database/entities/sales-return.entity';
import { SalesReturnItem } from './database/entities/sales-return-item.entity';
import { Setting } from './database/entities/setting.entity';
import { StockTransferEntity } from './database/entities/stock-transfer.entity';
import { Supplier } from './database/entities/supplier.entity';
import { User } from './database/entities/user.entity';
import { UserRole } from './database/entities/user-role.entity';
import { ExpensesModule } from './expenses/expenses.module';
import { PaymentsModule } from './payments/payments.module';
import { PermissionsModule } from './permissions/permissions.module';
import { PurchaseModule } from './purchase/purchase.module';
import { PurchaseReturnModule } from './purchase-return/purchase-return.module';
import { ProductsModule } from './products/products.module';
import { ReportsModule } from './reports/reports.module';
import { RolesModule } from './roles/roles.module';
import { SalesModule } from './sales/sales.module';
import { SalesReturnModule } from './sales-return/sales-return.module';
import { SettingsModule } from './settings/settings.module';
import { SupplierModule } from './supplier/supplier.module';
import { UnitsModule } from './units/units.module';
import { UserRolesModule } from './user-roles/user-roles.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const synchronize =
          configService.get<string>('DB_SYNCHRONIZE', 'false') === 'true';
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');
        if (nodeEnv === 'production' && synchronize) {
          throw new Error('DB_SYNCHRONIZE must be false in production.');
        }

        return {
          type: 'postgres' as const,
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: Number(configService.get<string>('DB_PORT', '5432')),
          username: configService.get<string>('DB_USERNAME', 'postgres'),
          password: configService.get<string>('DB_PASSWORD', 'postgres'),
          database: configService.get<string>('DB_NAME', 'inventory_pos'),
          entities: [
            User,
            Role,
            Permission,
            RolePermission,
            UserRole,
            Product,
            Category,
            Unit,
            BranchEntity,
            BranchProductEntity,
            StockTransferEntity,
            Supplier,
            Sale,
            SaleItem,
            SalesReturn,
            SalesReturnItem,
            Purchase,
            PurchaseItem,
            PurchaseReturn,
            PurchaseReturnItem,
            Expense,
            Setting,
            Customer,
            Payment,
          ],
          synchronize,
          ssl: configService.get<string>('DB_SSL', 'false') === 'true',
        };
      },
    }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    ProductsModule,
    BranchesModule,
    CategoriesModule,
    UnitsModule,
    ReportsModule,
    SalesModule,
    SalesReturnModule,
    SupplierModule,
    PurchaseModule,
    PurchaseReturnModule,
    ExpensesModule,
    SettingsModule,
    DashboardModule,
    CustomersModule,
    PaymentsModule,
    PermissionsModule,
    RolesModule,
    UserRolesModule,
  ],
})
export class AppModule {}
