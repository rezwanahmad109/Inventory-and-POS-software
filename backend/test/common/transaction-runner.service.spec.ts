import { DataSource, EntityManager } from 'typeorm';

import { TransactionRunnerService } from '../../src/common/services/transaction-runner.service';

describe('TransactionRunnerService', () => {
  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {} as EntityManager,
  };

  const dataSource = {
    createQueryRunner: jest.fn(() => queryRunner),
  } as unknown as DataSource;

  let service: TransactionRunnerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TransactionRunnerService(dataSource);
  });

  it('commits transaction when operation succeeds', async () => {
    const result = await service.runInTransaction(async () => 'ok');

    expect(result).toBe('ok');
    expect(queryRunner.startTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back transaction when operation throws', async () => {
    await expect(
      service.runInTransaction(async () => {
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');

    expect(queryRunner.startTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });
});
