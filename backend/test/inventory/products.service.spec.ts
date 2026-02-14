import { describe, expect, it, jest } from '@jest/globals';
import { Repository } from 'typeorm';

import { Product } from '../../src/database/entities/product.entity';
import { ProductsService } from '../../src/products/products.service';

describe('ProductsService low-stock threshold boundary', () => {
  const service = new ProductsService(
    {} as Repository<Product>,
    {} as Repository<any>,
    {} as Repository<any>,
    {} as Repository<any>,
    {} as Repository<any>,
    {} as any,
  );

  it('logs when stock moves from above threshold to exactly threshold', () => {
    const warn = jest.fn();
    (service as any).logger = { warn };

    const product = {
      id: 'product-1',
      sku: 'SKU-1',
      stockQty: 10,
      lowStockThreshold: 10,
    } as Product;

    service.handleStockLevelChange(product, 11, 'unit_test');

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not log when stock was already low', () => {
    const warn = jest.fn();
    (service as any).logger = { warn };

    const product = {
      id: 'product-2',
      sku: 'SKU-2',
      stockQty: 9,
      lowStockThreshold: 10,
    } as Product;

    service.handleStockLevelChange(product, 10, 'unit_test');

    expect(warn).not.toHaveBeenCalled();
  });
});
