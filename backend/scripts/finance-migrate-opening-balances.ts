/*
  Opening balance migration helper (template)
  -------------------------------------------------
  Usage (example):
    ts-node scripts/finance-migrate-opening-balances.ts --cutover=2026-02-01

  Purpose:
  1) Read legacy balances
  2) Build one opening journal that remains balanced
  3) Insert open invoices/bills into finance_invoices
*/

import { DataSource } from 'typeorm';

async function main() {
  // TODO: initialize with your runtime datasource config
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'inventory_pos',
    entities: [],
  });

  await dataSource.initialize();

  const cutover = process.argv
    .find((arg) => arg.startsWith('--cutover='))
    ?.split('=')[1] ?? new Date().toISOString().slice(0, 10);

  await dataSource.transaction(async (manager) => {
    // 1) Pull legacy summary snapshots (replace with real source queries/files)
    // const legacyTrialBalance = await manager.query('SELECT ...');
    // const legacyOpenSales = await manager.query('SELECT ...');
    // const legacyOpenPurchases = await manager.query('SELECT ...');

    // 2) Validate accounting equation before posting
    // assert(totalDebits === totalCredits)

    // 3) Insert opening journal entry and lines
    // await manager.query('INSERT INTO journal_entries (...) VALUES (...)');
    // await manager.query('INSERT INTO journal_lines (...) VALUES (...)');

    // 4) Insert open invoices into finance_invoices
    // await manager.query('INSERT INTO finance_invoices (...) SELECT ...');

    // 5) Optionally insert finance_parties mappings
  });

  await dataSource.destroy();
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Opening balance migration failed', error);
  process.exit(1);
});
