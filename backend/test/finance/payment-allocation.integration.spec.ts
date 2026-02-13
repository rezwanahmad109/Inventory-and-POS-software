import { describe, expect, it } from '@jest/globals';

describe('Payment allocation integration template', () => {
  it.todo('creates payment, allocates across multiple invoices, and updates balances');

  it.todo('prevents allocation overflow beyond invoice balance_due');

  it.todo('posts journal + wallet transaction atomically in one DB transaction');

  it('documents expected fixture shape', () => {
    const samplePayload = {
      walletId: 'wallet-uuid',
      direction: 'receipt',
      amount: 150,
      paymentMethod: 'bank_transfer',
      idempotencyKey: 'pay-150-001',
      allocations: [
        { invoiceId: 'inv-a', allocatedAmount: 100 },
        { invoiceId: 'inv-b', allocatedAmount: 50 },
      ],
    };

    expect(samplePayload.allocations).toHaveLength(2);
  });
});
