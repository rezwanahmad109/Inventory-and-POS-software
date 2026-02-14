import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { CategoriesModule } from './categories/categories.module';
import { CashflowModule } from './cashflow/cashflow.module';
import { CompanySettingsModule } from './company-settings/company-settings.module';
import { CommonModule } from './common/common.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { AuditLog } from './database/entities/audit-log.entity';
import { BankStatement } from './database/entities/bank-statement.entity';
import { BankStatementLine } from './database/entities/bank-statement-line.entity';
import { BranchEntity } from './database/entities/branch.entity';
import { BranchProductEntity } from './database/entities/branch-product.entity';
import { Customer } from './database/entities/customer.entity';
import { EmailTemplateEntity } from './database/entities/email-template.entity';
import { ExpenseCategory } from './database/entities/expense-category.entity';
import { Expense } from './database/entities/expense.entity';
import { FileAttachmentEntity } from './database/entities/file-attachment.entity';
import { FinanceAccount } from './database/entities/finance-account.entity';
import { FinanceInvoice } from './database/entities/finance-invoice.entity';
import { FinanceParty } from './database/entities/finance-party.entity';
import { FinancePayment } from './database/entities/finance-payment.entity';
import { IdempotencyKey } from './database/entities/idempotency-key.entity';
import { InvoiceSequence } from './database/entities/invoice-sequence.entity';
import { JournalEntry, JournalLine } from './database/entities/journal-entry.entity';
import { Payment } from './database/entities/payment.entity';
import { PaymentAllocation } from './database/entities/payment-allocation.entity';
import { Permission } from './database/entities/permission.entity';
import { PriceTierEntity } from './database/entities/price-tier.entity';
import { PosOrder } from './database/entities/pos-order.entity';
import { ProductPriceTierEntity } from './database/entities/product-price-tier.entity';
import { Category, Product, Unit } from './database/entities/product.entity';
import { PurchaseItem } from './database/entities/purchase-item.entity';
import { PurchasePayment } from './database/entities/purchase-payment.entity';
import { PurchaseReturn } from './database/entities/purchase-return.entity';
import { PurchaseReturnItem } from './database/entities/purchase-return-item.entity';
import { Purchase } from './database/entities/purchase.entity';
import { ReconciliationMatch } from './database/entities/reconciliation-match.entity';
import { Role } from './database/entities/role.entity';
import { RolePermission } from './database/entities/role-permission.entity';
import { SaleItem } from './database/entities/sale-item.entity';
import { SalePayment } from './database/entities/sale-payment.entity';
import { Sale } from './database/entities/sale.entity';
import { SalesReturnPayment } from './database/entities/sales-return-payment.entity';
import { SalesReturn } from './database/entities/sales-return.entity';
import { SalesReturnItem } from './database/entities/sales-return-item.entity';
import { Setting } from './database/entities/setting.entity';
import { StockLedgerEntry } from './database/entities/stock-ledger.entity';
import { StockTransferEntity } from './database/entities/stock-transfer.entity';
import { SubscriptionPlanEntity } from './database/entities/subscription-plan.entity';
import { Supplier } from './database/entities/supplier.entity';
import { TaxEntity } from './database/entities/tax.entity';
import { User } from './database/entities/user.entity';
import { UserRole } from './database/entities/user-role.entity';
import { ExpensesModule } from './expenses/expenses.module';
import { FinanceModule } from './finance/finance.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { PermissionsModule } from './permissions/permissions.module';
import { PriceTiersModule } from './price-tiers/price-tiers.module';
import { PurchaseModule } from './purchase/purchase.module';
import { PurchaseReturnModule } from './purchase-return/purchase-return.module';
import { ProductsModule } from './products/products.module';
import { PosModule } from './pos/pos.module';
import { ReportsModule } from './reports/reports.module';
import { RolesModule } from './roles/roles.module';
import { SalesModule } from './sales/sales.module';
import { SalesReturnModule } from './sales-return/sales-return.module';
import { SettingsModule } from './settings/settings.module';
import { SubscriptionPlansModule } from './subscription-plans/subscription-plans.module';
import { SupplierModule } from './supplier/supplier.module';
import { TaxesModule } from './taxes/taxes.module';
import { UploadsModule } from './uploads/uploads.module';
import { UnitsModule } from './units/units.module';
import { UserRolesModule } from './user-roles/user-roles.module';
import { UsersModule } from './users/users.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { WalletTransaction } from './database/entities/wallet-transaction.entity';
import { Wallet } from './database/entities/wallet.entity';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
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
            PosOrder,
            Product,
            Category,
            Unit,
            BranchEntity,
            BranchProductEntity,
            StockTransferEntity,
            StockLedgerEntry,
            Supplier,
            Sale,
            SaleItem,
            SalePayment,
            SalesReturn,
            SalesReturnItem,
            SalesReturnPayment,
            Purchase,
            PurchaseItem,
            PurchasePayment,
            PurchaseReturn,
            PurchaseReturnItem,
            ExpenseCategory,
            Expense,
            Setting,
            Customer,
            Payment,
            AuditLog,
            InvoiceSequence,
            FinanceAccount,
            FinanceParty,
            FinanceInvoice,
            JournalEntry,
            JournalLine,
            Wallet,
            WalletTransaction,
            TaxEntity,
            PriceTierEntity,
            ProductPriceTierEntity,
            SubscriptionPlanEntity,
            EmailTemplateEntity,
            FileAttachmentEntity,
            BankStatement,
            BankStatementLine,
            ReconciliationMatch,
            FinancePayment,
            PaymentAllocation,
            IdempotencyKey,
          ],
          synchronize,
          ssl: configService.get<string>('DB_SSL', 'false') === 'true',
        };
      },
    }),
    CommonModule,
    DatabaseModule,
    UsersModule,
    AuthModule,
    ProductsModule,
    PosModule,
    BranchesModule,
    CashflowModule,
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
    CompanySettingsModule,
    TaxesModule,
    WarehousesModule,
    SubscriptionPlansModule,
    PriceTiersModule,
    UploadsModule,
    NotificationsModule,
    DashboardModule,
    CustomersModule,
    PaymentsModule,
    PermissionsModule,
    RolesModule,
    UserRolesModule,
    FinanceModule,
  ],
})
export class AppModule {}
