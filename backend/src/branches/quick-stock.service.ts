import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BranchProductEntity } from '../database/entities/branch-product.entity';

@Injectable()
export class QuickStockService {
  private readonly cacheTtlMs = 15_000;
  private cachedLowStockRows: BranchProductEntity[] | null = null;
  private cacheExpiresAt = 0;

  constructor(
    @InjectRepository(BranchProductEntity)
    private readonly branchProductsRepository: Repository<BranchProductEntity>,
  ) {}

  isLowStock(
    stockQuantity: number,
    threshold: number | null | undefined,
  ): boolean {
    const normalizedThreshold = threshold ?? 0;
    return normalizedThreshold > 0 && stockQuantity <= normalizedThreshold;
  }

  crossedIntoLowStock(
    previousStockQuantity: number,
    nextStockQuantity: number,
    threshold: number | null | undefined,
  ): boolean {
    const normalizedThreshold = threshold ?? 0;
    if (normalizedThreshold <= 0) {
      return false;
    }

    return (
      previousStockQuantity > normalizedThreshold &&
      nextStockQuantity <= normalizedThreshold
    );
  }

  async getLowStockAcrossBranches(
    forceRefresh = false,
  ): Promise<BranchProductEntity[]> {
    const now = Date.now();
    if (
      !forceRefresh &&
      this.cachedLowStockRows &&
      now < this.cacheExpiresAt
    ) {
      return this.cachedLowStockRows;
    }

    const lowStockRows = await this.branchProductsRepository
      .createQueryBuilder('branchProduct')
      .leftJoinAndSelect('branchProduct.branch', 'branch')
      .leftJoinAndSelect('branchProduct.product', 'product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.unit', 'unit')
      .where('branchProduct.low_stock_threshold > 0')
      .andWhere('branchProduct.stock_quantity <= branchProduct.low_stock_threshold')
      .andWhere('branch.is_active = true')
      .orderBy('branchProduct.stock_quantity', 'ASC')
      .addOrderBy('branch.updated_at', 'DESC')
      .getMany();

    this.cachedLowStockRows = lowStockRows;
    this.cacheExpiresAt = now + this.cacheTtlMs;
    return lowStockRows;
  }

  invalidateLowStockCache(): void {
    this.cachedLowStockRows = null;
    this.cacheExpiresAt = 0;
  }
}
