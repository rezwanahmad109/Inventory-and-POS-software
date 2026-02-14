import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FinanceAccount } from '../../database/entities/finance-account.entity';
import { CreateFinanceAccountDto } from '../dto/create-finance-account.dto';
import { UpdateFinanceAccountDto } from '../dto/update-finance-account.dto';

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
      order: { code: 'ASC' },
    });
  }

  async create(dto: CreateFinanceAccountDto): Promise<FinanceAccount> {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.financeAccountRepository.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException(`Finance account code "${code}" already exists.`);
    }

    const account = this.financeAccountRepository.create({
      code,
      name: dto.name.trim(),
      accountType: dto.accountType,
      subType: dto.subType?.trim() ?? null,
      isContra: dto.isContra ?? false,
      currency: (dto.currency ?? 'USD').toUpperCase(),
      isActive: dto.isActive ?? true,
    });

    return this.financeAccountRepository.save(account);
  }

  async update(id: string, dto: UpdateFinanceAccountDto): Promise<FinanceAccount> {
    const account = await this.financeAccountRepository.findOne({ where: { id } });
    if (!account) {
      throw new NotFoundException(`Finance account "${id}" not found.`);
    }

    if (dto.code !== undefined) {
      const code = dto.code.trim().toUpperCase();
      if (code !== account.code) {
        const duplicate = await this.financeAccountRepository.findOne({ where: { code } });
        if (duplicate) {
          throw new ConflictException(`Finance account code "${code}" already exists.`);
        }
        account.code = code;
      }
    }

    if (dto.name !== undefined) {
      account.name = dto.name.trim();
    }
    if (dto.accountType !== undefined) {
      account.accountType = dto.accountType;
    }
    if (dto.subType !== undefined) {
      account.subType = dto.subType?.trim() ?? null;
    }
    if (dto.isContra !== undefined) {
      account.isContra = dto.isContra;
    }
    if (dto.currency !== undefined) {
      account.currency = dto.currency.toUpperCase();
    }
    if (dto.isActive !== undefined) {
      account.isActive = dto.isActive;
    }

    return this.financeAccountRepository.save(account);
  }

  async remove(id: string): Promise<void> {
    const account = await this.financeAccountRepository.findOne({ where: { id } });
    if (!account) {
      throw new NotFoundException(`Finance account "${id}" not found.`);
    }

    account.isActive = false;
    await this.financeAccountRepository.save(account);
  }
}
