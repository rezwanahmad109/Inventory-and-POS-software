import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { WalletTransaction } from '../../database/entities/wallet-transaction.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { CreateWalletDto } from '../dto/create-wallet.dto';
import { WalletBalanceAdjustmentDto } from '../dto/wallet-balance-adjustment.dto';
import { WalletTransactionQueryDto } from '../dto/wallet-transaction-query.dto';
import { WalletTransferDto } from '../dto/wallet-transfer.dto';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private readonly walletTransactionRepository: Repository<WalletTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateWalletDto): Promise<Wallet> {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.walletRepository.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException(`Wallet code "${code}" already exists.`);
    }

    const openingBalance = Number((dto.openingBalance ?? 0).toFixed(2));
    const wallet = this.walletRepository.create({
      code,
      name: dto.name.trim(),
      type: dto.type,
      currency: (dto.currency ?? 'USD').toUpperCase(),
      openingBalance,
      currentBalance: openingBalance,
    });

    return this.walletRepository.save(wallet);
  }

  async findAll(): Promise<Wallet[]> {
    return this.walletRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findTransactions(
    walletId: string,
    query: WalletTransactionQueryDto,
  ): Promise<WalletTransaction[]> {
    const wallet = await this.walletRepository.findOne({ where: { id: walletId } });
    if (!wallet) {
      throw new NotFoundException(`Wallet "${walletId}" not found.`);
    }

    const limit = query.limit ?? 100;
    const qb = this.walletTransactionRepository
      .createQueryBuilder('txn')
      .where('txn.wallet_id = :walletId', { walletId })
      .orderBy('txn.txn_date', 'DESC')
      .addOrderBy('txn.created_at', 'DESC')
      .take(limit);

    if (query.from) {
      qb.andWhere('txn.txn_date >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('txn.txn_date <= :to', { to: query.to });
    }

    return qb.getMany();
  }

  async topUp(
    walletId: string,
    dto: WalletBalanceAdjustmentDto,
    actorId?: string,
  ): Promise<Wallet> {
    return this.adjustBalance(walletId, dto, 'in', actorId);
  }

  async withdraw(
    walletId: string,
    dto: WalletBalanceAdjustmentDto,
    actorId?: string,
  ): Promise<Wallet> {
    return this.adjustBalance(walletId, dto, 'out', actorId);
  }

  async transfer(dto: WalletTransferDto, actorId?: string): Promise<{
    fromWallet: Wallet;
    toWallet: Wallet;
    outTransaction: WalletTransaction;
    inTransaction: WalletTransaction;
  }> {
    if (dto.fromWalletId === dto.toWalletId) {
      throw new BadRequestException('fromWalletId and toWalletId must be different.');
    }

    return this.dataSource.transaction(async (manager) => {
      if (dto.idempotencyKey) {
        const existingOut = await manager.findOne(WalletTransaction, {
          where: {
            idempotencyKey: `${dto.idempotencyKey}:out`,
          },
          relations: { wallet: true },
        });
        const existingIn = await manager.findOne(WalletTransaction, {
          where: {
            idempotencyKey: `${dto.idempotencyKey}:in`,
          },
          relations: { wallet: true },
        });

        if (existingOut && existingIn) {
          const fromWallet = await manager.findOne(Wallet, {
            where: { id: dto.fromWalletId },
          });
          const toWallet = await manager.findOne(Wallet, {
            where: { id: dto.toWalletId },
          });

          if (!fromWallet || !toWallet) {
            throw new NotFoundException('One of the transfer wallets no longer exists.');
          }

          return {
            fromWallet,
            toWallet,
            outTransaction: existingOut,
            inTransaction: existingIn,
          };
        }
      }

      const fromWallet = await manager.findOne(Wallet, {
        where: { id: dto.fromWalletId },
        lock: { mode: 'pessimistic_write' },
      });
      const toWallet = await manager.findOne(Wallet, {
        where: { id: dto.toWalletId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!fromWallet || !toWallet) {
        throw new NotFoundException('One or both wallets not found.');
      }

      const amount = Number(dto.amount.toFixed(2));
      if (amount <= 0) {
        throw new BadRequestException('Transfer amount must be positive.');
      }

      if (fromWallet.currentBalance < amount) {
        throw new BadRequestException(
          `Insufficient balance in wallet ${fromWallet.code}.`,
        );
      }

      fromWallet.currentBalance = Number((fromWallet.currentBalance - amount).toFixed(2));
      toWallet.currentBalance = Number((toWallet.currentBalance + amount).toFixed(2));

      await manager.save(Wallet, fromWallet);
      await manager.save(Wallet, toWallet);

      const txnDate = dto.txnDate ? new Date(dto.txnDate) : new Date();
      const description = dto.description?.trim() || null;

      const outTransaction = manager.create(WalletTransaction, {
        walletId: fromWallet.id,
        txnDate,
        direction: 'out',
        amount,
        referenceType: 'wallet_transfer',
        referenceId: toWallet.id,
        description,
        idempotencyKey: dto.idempotencyKey ? `${dto.idempotencyKey}:out` : null,
      });

      const inTransaction = manager.create(WalletTransaction, {
        walletId: toWallet.id,
        txnDate,
        direction: 'in',
        amount,
        referenceType: 'wallet_transfer',
        referenceId: fromWallet.id,
        description,
        idempotencyKey: dto.idempotencyKey ? `${dto.idempotencyKey}:in` : null,
      });

      const savedOut = await manager.save(WalletTransaction, outTransaction);
      const savedIn = await manager.save(WalletTransaction, inTransaction);

      return {
        fromWallet,
        toWallet,
        outTransaction: savedOut,
        inTransaction: savedIn,
      };
    });
  }

  private async adjustBalance(
    walletId: string,
    dto: WalletBalanceAdjustmentDto,
    direction: 'in' | 'out',
    actorId?: string,
  ): Promise<Wallet> {
    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, {
        where: { id: walletId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) {
        throw new NotFoundException(`Wallet "${walletId}" not found.`);
      }

      if (dto.idempotencyKey) {
        const existing = await manager.findOne(WalletTransaction, {
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (existing) {
          return wallet;
        }
      }

      const amount = Number(dto.amount.toFixed(2));
      if (amount <= 0) {
        throw new BadRequestException('Amount must be positive.');
      }

      const delta = direction === 'in' ? amount : -amount;
      const nextBalance = Number((wallet.currentBalance + delta).toFixed(2));
      if (nextBalance < 0) {
        throw new BadRequestException(`Wallet ${wallet.code} cannot go negative.`);
      }

      wallet.currentBalance = nextBalance;
      await manager.save(Wallet, wallet);

      await manager.save(
        WalletTransaction,
        manager.create(WalletTransaction, {
          walletId: wallet.id,
          txnDate: dto.txnDate ? new Date(dto.txnDate) : new Date(),
          direction,
          amount,
          referenceType: dto.referenceType?.trim() || 'manual_adjustment',
          referenceId: dto.referenceId?.trim() || actorId || null,
          description: dto.description?.trim() || null,
          idempotencyKey: dto.idempotencyKey ?? null,
        }),
      );

      return wallet;
    });
  }
}
