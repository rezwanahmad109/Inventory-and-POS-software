import { spawnSync } from 'child_process';

import { DataSource } from 'typeorm';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';

import { FinanceAccount } from '../../src/database/entities/finance-account.entity';
import { JournalEntry, JournalLine } from '../../src/database/entities/journal-entry.entity';
import { PeriodLock } from '../../src/database/entities/period-lock.entity';
import { JournalPostingService } from '../../src/finance/services/journal-posting.service';

const dockerAvailable = (() => {
  const result = spawnSync('docker', ['version'], { stdio: 'ignore' });
  return result.status === 0;
})();

const describeIfDocker = dockerAvailable ? describe : describe.skip;

describeIfDocker('Journal Posting DB invariants (testcontainers)', () => {
  let container: StartedTestContainer;
  let dataSource: DataSource;
  let service: JournalPostingService;

  beforeAll(async () => {
    const dbName = 'inventory_pos_test';
    const dbUser = 'test_user';
    const dbPassword = 'test_password';
    container = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_DB: dbName,
        POSTGRES_USER: dbUser,
        POSTGRES_PASSWORD: dbPassword,
      })
      .withExposedPorts(5432)
      .withWaitStrategy(
        Wait.forLogMessage('database system is ready to accept connections'),
      )
      .start();

    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      username: dbUser,
      password: dbPassword,
      database: dbName,
      synchronize: true,
      entities: [FinanceAccount, JournalEntry, JournalLine, PeriodLock],
    });

    await dataSource.initialize();
    await installJournalImmutabilityTrigger(dataSource);
    await seedCoreAccounts(dataSource);

    service = new JournalPostingService(dataSource);
  }, 120_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    if (container) {
      await container.stop();
    }
  });

  it('returns existing posted journal on idempotency key reuse', async () => {
    const ar = await findAccountByCode(dataSource, '1100-AR');
    const sales = await findAccountByCode(dataSource, '4000-SALES');

    const first = await service.post({
      entryDate: new Date('2026-02-01'),
      sourceType: 'sales_invoice',
      sourceId: 'sale-1',
      idempotencyKey: 'sales:invoice:case-1',
      lines: [
        { accountId: ar.id, debit: 100, credit: 0 },
        { accountId: sales.id, debit: 0, credit: 100 },
      ],
    });

    const second = await service.post({
      entryDate: new Date('2026-02-01'),
      sourceType: 'sales_invoice',
      sourceId: 'sale-1',
      idempotencyKey: 'sales:invoice:case-1',
      lines: [
        { accountId: ar.id, debit: 100, credit: 0 },
        { accountId: sales.id, debit: 0, credit: 100 },
      ],
    });

    expect(second.id).toBe(first.id);
  });

  it('enforces posted journal immutability at database level', async () => {
    const ar = await findAccountByCode(dataSource, '1100-AR');
    const sales = await findAccountByCode(dataSource, '4000-SALES');

    const posted = await service.post({
      entryDate: new Date('2026-02-02'),
      sourceType: 'sales_invoice',
      sourceId: 'sale-2',
      idempotencyKey: 'sales:invoice:case-2',
      lines: [
        { accountId: ar.id, debit: 55, credit: 0 },
        { accountId: sales.id, debit: 0, credit: 55 },
      ],
    });

    await expect(
      dataSource.query('UPDATE journal_entries SET description = $1 WHERE id = $2', [
        'tamper attempt',
        posted.id,
      ]),
    ).rejects.toBeTruthy();
  });
});

async function seedCoreAccounts(dataSource: DataSource): Promise<void> {
  const repository = dataSource.getRepository(FinanceAccount);
  const rows: Array<
    Pick<
      FinanceAccount,
      'code' | 'name' | 'accountType' | 'subType' | 'isContra' | 'currency' | 'isActive'
    >
  > = [
    {
      code: '1100-AR',
      name: 'Trade Receivables',
      accountType: 'asset',
      subType: 'accounts_receivable',
      isContra: false,
      currency: 'USD',
      isActive: true,
    },
    {
      code: '4000-SALES',
      name: 'Sales Revenue',
      accountType: 'revenue',
      subType: 'operating_revenue',
      isContra: false,
      currency: 'USD',
      isActive: true,
    },
  ];

  for (const row of rows) {
    const existing = await repository.findOne({ where: { code: row.code } });
    if (!existing) {
      await repository.save(repository.create(row));
    }
  }
}

async function findAccountByCode(
  dataSource: DataSource,
  code: string,
): Promise<FinanceAccount> {
  const account = await dataSource
    .getRepository(FinanceAccount)
    .findOne({ where: { code } });
  if (!account) {
    throw new Error(`Missing seeded account ${code}`);
  }
  return account;
}

async function installJournalImmutabilityTrigger(dataSource: DataSource): Promise<void> {
  await dataSource.query(`
    CREATE OR REPLACE FUNCTION fn_journal_entry_immutable()
    RETURNS trigger AS $$
    BEGIN
      IF OLD.status = 'posted' THEN
        RAISE EXCEPTION 'Posted journal entries are immutable. Use reversal entries.';
      END IF;

      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await dataSource.query(`
    DROP TRIGGER IF EXISTS trg_journal_entry_immutable ON journal_entries;
    CREATE TRIGGER trg_journal_entry_immutable
    BEFORE UPDATE OR DELETE
    ON journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION fn_journal_entry_immutable();
  `);
}
