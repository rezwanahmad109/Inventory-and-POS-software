import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { WalletTransaction } from '../../src/database/entities/wallet-transaction.entity';
import { Wallet } from '../../src/database/entities/wallet.entity';
import { WalletsService } from '../../src/finance/services/wallets.service';

describe('WalletsService', () => {
  let service: WalletsService;

  const walletRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const walletTransactionRepository = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const dataSource = {
    transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        {
          provide: getRepositoryToken(Wallet),
          useValue: walletRepository,
        },
        {
          provide: getRepositoryToken(WalletTransaction),
          useValue: walletTransactionRepository,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    })
      .overrideProvider(DataSource)
      .useValue(dataSource)
      .compile();

    service = module.get<WalletsService>(WalletsService);
  });

  it('transfers amount between wallets and writes ledger transactions', async () => {
    const fromWallet = {
      id: 'from-wallet',
      code: 'CASH_MAIN',
      currentBalance: 200,
    } as Wallet;

    const toWallet = {
      id: 'to-wallet',
      code: 'BANK_MAIN',
      currentBalance: 50,
    } as Wallet;

    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(fromWallet)
        .mockResolvedValueOnce(toWallet),
      save: jest.fn().mockImplementation((_entity: any, payload: any) =>
        Promise.resolve({ ...payload, id: payload.id ?? 'txn-id' }),
      ),
      create: jest.fn().mockImplementation((_entity: any, payload: any) => payload),
    };

    dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

    const result = await service.transfer({
      fromWalletId: 'from-wallet',
      toWalletId: 'to-wallet',
      amount: 75,
      description: 'Transfer for safe deposit',
    });

    expect(result.fromWallet.currentBalance).toBe(125);
    expect(result.toWallet.currentBalance).toBe(125);
    expect(manager.save).toHaveBeenCalled();
  });

  it('rejects transfer when source wallet has insufficient balance', async () => {
    const fromWallet = {
      id: 'from-wallet',
      code: 'CASH_MAIN',
      currentBalance: 20,
    } as Wallet;

    const toWallet = {
      id: 'to-wallet',
      code: 'BANK_MAIN',
      currentBalance: 50,
    } as Wallet;

    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(fromWallet)
        .mockResolvedValueOnce(toWallet),
      save: jest.fn(),
      create: jest.fn(),
    };

    dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

    await expect(
      service.transfer({
        fromWalletId: 'from-wallet',
        toWalletId: 'to-wallet',
        amount: 75,
      }),
    ).rejects.toThrow('Insufficient balance');
  });
});
