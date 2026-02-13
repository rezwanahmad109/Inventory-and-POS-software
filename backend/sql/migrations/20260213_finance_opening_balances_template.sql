-- 20260213_finance_opening_balances_template.sql
-- Template migration script for legacy balances into Finance Trust Layer.

BEGIN;

-- 1) Seed chart of accounts first (or ensure custom chart is loaded).
-- 2) Insert parties mapped from existing customers/suppliers.
INSERT INTO finance_parties (party_type, display_name, phone, email, customer_id)
SELECT 'customer', c.name, c.phone, c.email, c.id
FROM customers c
WHERE NOT EXISTS (
  SELECT 1 FROM finance_parties fp WHERE fp.customer_id = c.id
);

INSERT INTO finance_parties (party_type, display_name, phone, email, supplier_id)
SELECT 'supplier', s.name, s.phone, s.email, s.id
FROM suppliers s
WHERE NOT EXISTS (
  SELECT 1 FROM finance_parties fp WHERE fp.supplier_id = s.id
);

-- 3) Opening Journal (at cut-over date) from legacy trial balances.
-- Replace <<CUTOVER_DATE>> and <<OPENING_ENTRY_NO>>.
WITH opening_entry AS (
  INSERT INTO journal_entries (
    entry_no,
    entry_date,
    source_type,
    description,
    status,
    posted_at
  ) VALUES (
    '<<OPENING_ENTRY_NO>>',
    '<<CUTOVER_DATE>>',
    'opening_balance',
    'Opening balances migration',
    'posted',
    NOW()
  ) RETURNING id
)
INSERT INTO journal_lines (journal_entry_id, line_no, account_id, debit, credit, memo)
SELECT
  opening_entry.id,
  x.line_no,
  x.account_id,
  x.debit,
  x.credit,
  x.memo
FROM opening_entry,
LATERAL (
  VALUES
  -- Example rows; replace with computed balances from legacy system:
  (1, (SELECT id FROM finance_accounts WHERE code = '1000-CASH'), 5000.00, 0.00, 'Opening cash'),
  (2, (SELECT id FROM finance_accounts WHERE code = '1100-AR'), 12000.00, 0.00, 'Opening receivables'),
  (3, (SELECT id FROM finance_accounts WHERE code = '1200-INVENTORY'), 25000.00, 0.00, 'Opening inventory'),
  (4, (SELECT id FROM finance_accounts WHERE code = '2100-AP'), 0.00, 7000.00, 'Opening payables'),
  (5, (SELECT id FROM finance_accounts WHERE code = '3000-EQUITY'), 0.00, 35000.00, 'Opening equity plug')
) AS x(line_no, account_id, debit, credit, memo);

-- 4) Migrate open sales invoices into finance_invoices.
INSERT INTO finance_invoices (
  document_no,
  document_type,
  party_id,
  sale_id,
  issue_date,
  due_date,
  subtotal,
  tax_total,
  total_amount,
  balance_due,
  currency,
  status
)
SELECT
  s.invoice_number,
  'sales_invoice',
  fp.id,
  s.id,
  s.created_at::date,
  s.created_at::date,
  COALESCE(s.subtotal, s.total_amount),
  COALESCE(s.tax_total, 0),
  COALESCE(s.grand_total, s.total_amount),
  COALESCE(s.due_total, s.due_amount, 0),
  'USD',
  CASE WHEN COALESCE(s.due_total, s.due_amount, 0) <= 0 THEN 'paid' ELSE 'open' END
FROM sales s
LEFT JOIN finance_parties fp ON fp.customer_id = s.customer_id
WHERE COALESCE(s.due_total, s.due_amount, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM finance_invoices fi WHERE fi.sale_id = s.id);

-- 5) Migrate open purchase bills similarly.
INSERT INTO finance_invoices (
  document_no,
  document_type,
  party_id,
  purchase_id,
  issue_date,
  due_date,
  subtotal,
  tax_total,
  total_amount,
  balance_due,
  currency,
  status
)
SELECT
  p.invoice_number,
  'purchase_bill',
  fp.id,
  p.id,
  p.created_at::date,
  p.created_at::date,
  p.total_amount,
  0,
  p.total_amount,
  p.total_amount,
  'USD',
  'open'
FROM purchases p
LEFT JOIN finance_parties fp ON fp.supplier_id = p.supplier_id
WHERE NOT EXISTS (SELECT 1 FROM finance_invoices fi WHERE fi.purchase_id = p.id);

COMMIT;
