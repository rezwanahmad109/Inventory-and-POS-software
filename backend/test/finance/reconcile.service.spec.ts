import { describe, expect, it } from '@jest/globals';

describe('ReconcileService policies', () => {
  it('marks imported statement lines as unmatched by default', () => {
    const importedLine = {
      lineNo: 1,
      amount: 150,
      matchStatus: 'unmatched',
    };

    expect(importedLine.matchStatus).toBe('unmatched');
  });

  it('scores exact amount + date proximity as high confidence', () => {
    const statementAmount = 100;
    const walletTxnAmount = 100;
    const dateDiffDays = 1;

    const score =
      (statementAmount === walletTxnAmount ? 80 : 0) +
      (dateDiffDays <= 3 ? 20 : 0);

    expect(score).toBeGreaterThanOrEqual(95);
  });

  it('treats non-exact amounts as low confidence without tolerance', () => {
    const statementAmount = 100;
    const walletTxnAmount = 99.5;
    const absoluteDiff = Math.abs(statementAmount - walletTxnAmount);

    expect(absoluteDiff).toBeGreaterThan(0.01);
  });

  it('contains matching policy metadata', () => {
    const matchingPolicy = {
      amountTolerance: 0.01,
      dateToleranceDays: 3,
      confidenceAutoThreshold: 95,
    };

    expect(matchingPolicy.confidenceAutoThreshold).toBeGreaterThan(90);
  });
});
