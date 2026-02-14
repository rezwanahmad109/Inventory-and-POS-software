import { describe, expect, it } from '@jest/globals';
import { Repository } from 'typeorm';

import { QuickStockService } from '../../src/branches/quick-stock.service';
import { BranchProductEntity } from '../../src/database/entities/branch-product.entity';

describe('QuickStockService', () => {
  const service = new QuickStockService(
    {} as Repository<BranchProductEntity>,
  );

  it('flags low stock when quantity is exactly at threshold', () => {
    expect(service.isLowStock(5, 5)).toBe(true);
  });

  it('does not flag low stock when quantity is above threshold', () => {
    expect(service.isLowStock(6, 5)).toBe(false);
  });

  it('detects crossing into low stock at threshold boundary', () => {
    expect(service.crossedIntoLowStock(6, 5, 5)).toBe(true);
    expect(service.crossedIntoLowStock(5, 5, 5)).toBe(false);
  });
});
