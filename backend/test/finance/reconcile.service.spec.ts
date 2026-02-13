import { describe, expect, it } from '@jest/globals';

describe('ReconcileService template', () => {
  it.todo('imports statement lines and marks initial status as unmatched');

  it.todo('suggests match by wallet + amount + date tolerance');

  it.todo('creates reconciliation match and marks line as matched');

  it.todo('writes audit log row with actor/action/entity/before-after');

  it('contains matching policy metadata', () => {
    const matchingPolicy = {
      amountTolerance: 0.01,
      dateToleranceDays: 3,
      confidenceAutoThreshold: 95,
    };

    expect(matchingPolicy.confidenceAutoThreshold).toBeGreaterThan(90);
  });
});
