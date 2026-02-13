import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FinanceAccount } from '../../database/entities/finance-account.entity';

const DEFAULT_CHART_OF_ACCOUNTS: Array<
  Pick<FinanceAccount, 'code' | 'name' | 'accountType' | 'subType' | 'isContra'>
> = [
  { code: '1000-CASH', name: 'Cash and Cash Equivalents', accountType: 'asset', subType: 'cash', isContra: false },
  { code: '1100-AR', name: 'Trade Receivables', accountType: 'asset', subType: 'accounts_receivable', isContra: false },
  { code: '1200-INVENTORY', name: 'Inventory', accountType: 'asset', subType: 'inventory', isContra: false },
  { code: '1300-INPUT-TAX', name: 'Input Tax Receivable', accountType: 'asset', subType: 'tax_receivable', isContra: false },
  { code: '2100-AP', name: 'Trade Payables', accountType: 'liability', subType: 'accounts_payable', isContra: false },
  { code: '2200-OUTPUT-TAX', name: 'Output Tax Payable', accountType: 'liability', subType: 'tax_payable', isContra: false },
  { code: '3000-EQUITY', name: 'Owner Equity', accountType: 'equity', subType: 'capital', isContra: false },
  { code: '4000-SALES', name: 'Sales Revenue', accountType: 'revenue', subType: 'operating_revenue', isContra: false },
  { code: '5000-COGS', name: 'Cost of Goods Sold', accountType: 'expense', subType: 'cogs', isContra: false },
  { code: '6100-EXPENSE', name: 'Operating Expense', accountType: 'expense', subType: 'operating_expense', isContra: false },
];

@Injectable()
export class ChartOfAccountsService {
  constructor(
    @InjectRepository(FinanceAccount)
    private readonly financeAccountRepository: Repository<FinanceAccount>,
  ) {}

  async seedDefault(): Promise<FinanceAccount[]> {
    const created: FinanceAccount[] = [];

    for (const definition of DEFAULT_CHART_OF_ACCOUNTS) {
      const existing = await this.financeAccountRepository.findOne({
        where: { code: definition.code },
      });
      if (existing) {
        continue;
      }

      const account = this.financeAccountRepository.create({
        ...definition,
        currency: 'USD',
        isActive: true,
      });
      created.push(await this.financeAccountRepository.save(account));
    }

    return created;
  }

  async findAll(): Promise<FinanceAccount[]> {
    return this.financeAccountRepository.find({
      where: { isActive: true },
      order: { code: 'ASC' },
    });
  }
}
