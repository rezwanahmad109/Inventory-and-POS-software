import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  MoreThan,
  Repository,
} from 'typeorm';

import { BranchProductDto } from './dto/branch-product.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { StockTransferDto } from './dto/stock-transfer.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { BranchEntity } from '../database/entities/branch.entity';
import { BranchProductEntity } from '../database/entities/branch-product.entity';
import { Product } from '../database/entities/product.entity';
import {
  StockTransferEntity,
  StockTransferStatus,
} from '../database/entities/stock-transfer.entity';

export interface BranchProductView {
  id: string;
  branchId: string;
  branchName: string | null;
  productId: string;
  productName: string;
  sku: string;
  stockQuantity: number;
  lowStockThreshold: number;
  stockValue: number;
  isLowStock: boolean;
  unitPrice: number;
  product: Product;
}

@Injectable()
export class BranchesService {
  private readonly logger = new Logger(BranchesService.name);

  constructor(
    @InjectRepository(BranchEntity)
    private readonly branchesRepository: Repository<BranchEntity>,
    @InjectRepository(BranchProductEntity)
    private readonly branchProductsRepository: Repository<BranchProductEntity>,
    @InjectRepository(StockTransferEntity)
    private readonly stockTransfersRepository: Repository<StockTransferEntity>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    private readonly dataSource: DataSource,
  ) {}

  async createBranch(createBranchDto: CreateBranchDto): Promise<BranchEntity> {
    const code = createBranchDto.code.trim().toUpperCase();
    await this.ensureUniqueBranchCode(code);

    const branch = this.branchesRepository.create({
      name: createBranchDto.name.trim(),
      code,
      location: createBranchDto.location?.trim() || null,
      phone: createBranchDto.phone?.trim() || null,
      managerName: createBranchDto.managerName?.trim() || null,
      isActive: createBranchDto.isActive ?? true,
    });

    return this.branchesRepository.save(branch);
  }

  async findAllBranches(): Promise<BranchEntity[]> {
    return this.branchesRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async updateBranch(id: string, updateBranchDto: UpdateBranchDto): Promise<BranchEntity> {
    const branch = await this.getBranchOrFail(id);

    if (updateBranchDto.code !== undefined) {
      const nextCode = updateBranchDto.code.trim().toUpperCase();
      if (nextCode !== branch.code) {
        await this.ensureUniqueBranchCode(nextCode, branch.id);
      }
      branch.code = nextCode;
    }

    if (updateBranchDto.name !== undefined) {
      branch.name = updateBranchDto.name.trim();
    }
    if (updateBranchDto.location !== undefined) {
      branch.location = updateBranchDto.location.trim() || null;
    }
    if (updateBranchDto.phone !== undefined) {
      branch.phone = updateBranchDto.phone.trim() || null;
    }
    if (updateBranchDto.managerName !== undefined) {
      branch.managerName = updateBranchDto.managerName.trim() || null;
    }
    if (updateBranchDto.isActive !== undefined) {
      branch.isActive = updateBranchDto.isActive;
    }

    return this.branchesRepository.save(branch);
  }

  async removeBranch(id: string): Promise<{ mode: 'deactivated' | 'soft_deleted' }> {
    const branch = await this.getBranchOrFail(id);

    const linkedProductCount = await this.branchProductsRepository.count({
      where: { branchId: branch.id, stockQuantity: MoreThan(0) },
    });

    if (linkedProductCount > 0) {
      branch.isActive = false;
      await this.branchesRepository.save(branch);
      return { mode: 'deactivated' };
    }

    branch.isActive = false;
    await this.branchesRepository.save(branch);
    await this.branchesRepository.softDelete(branch.id);
    return { mode: 'soft_deleted' };
  }

  async getBranchProducts(branchId: string): Promise<BranchProductView[]> {
    await this.getBranchOrFail(branchId);

    const branchProducts = await this.branchProductsRepository.find({
      where: { branchId },
      relations: {
        branch: true,
        product: {
          category: true,
          unit: true,
        },
      },
      order: { updatedAt: 'DESC' },
    });

    return branchProducts.map((branchProduct) =>
      this.toBranchProductView(branchProduct),
    );
  }

  async updateBranchProductStock(
    branchId: string,
    productId: string,
    branchProductDto: BranchProductDto,
  ): Promise<BranchProductView> {
    return this.dataSource.transaction(async (manager) => {
      const branch = await this.getBranchOrFail(branchId, manager);
      if (!branch.isActive) {
        throw new BadRequestException(
          `Branch "${branch.name}" is inactive. Reactivate it before stock adjustments.`,
        );
      }

      if (
        branchProductDto.stockQuantity === undefined &&
        branchProductDto.adjustBy === undefined &&
        branchProductDto.lowStockThreshold === undefined
      ) {
        throw new BadRequestException(
          'Provide at least one field: stockQuantity, adjustBy, or lowStockThreshold.',
        );
      }

      const product = await manager.findOne(Product, {
        where: { id: productId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) {
        throw new NotFoundException(`Product "${productId}" not found.`);
      }

      let branchProduct = await manager.findOne(BranchProductEntity, {
        where: { branchId, productId },
        lock: { mode: 'pessimistic_write' },
        relations: { branch: true, product: true },
      });

      if (!branchProduct) {
        branchProduct = manager.create(BranchProductEntity, {
          branch,
          branchId: branch.id,
          product,
          productId: product.id,
          stockQuantity: 0,
          lowStockThreshold: product.lowStockThreshold ?? 0,
        });
      }

      const previousStockQuantity = branchProduct.stockQuantity;
      let nextStockQuantity = branchProduct.stockQuantity;

      if (branchProductDto.stockQuantity !== undefined) {
        nextStockQuantity = branchProductDto.stockQuantity;
      }

      if (branchProductDto.adjustBy !== undefined) {
        nextStockQuantity += branchProductDto.adjustBy;
      }

      if (nextStockQuantity < 0) {
        throw new BadRequestException(
          `Stock cannot be negative for product "${product.name}" in branch "${branch.name}".`,
        );
      }

      branchProduct.stockQuantity = nextStockQuantity;
      if (branchProductDto.lowStockThreshold !== undefined) {
        branchProduct.lowStockThreshold = branchProductDto.lowStockThreshold;
      }

      const delta = nextStockQuantity - previousStockQuantity;
      if (delta !== 0) {
        product.stockQty += delta;
        if (product.stockQty < 0) {
          throw new BadRequestException(
            `Global stock would become negative for product "${product.name}".`,
          );
        }
        await manager.save(Product, product);
      }

      await manager.save(BranchProductEntity, branchProduct);
      this.logLowStockCrossing(branchProduct, previousStockQuantity, 'branch_adjustment');

      const reloaded = await manager.findOne(BranchProductEntity, {
        where: { id: branchProduct.id },
        relations: {
          branch: true,
          product: {
            category: true,
            unit: true,
          },
        },
      });

      if (!reloaded) {
        throw new NotFoundException('Updated branch product row could not be loaded.');
      }

      return this.toBranchProductView(reloaded);
    });
  }

  async getLowStockAcrossBranches(): Promise<BranchProductView[]> {
    const lowStockRows = await this.branchProductsRepository
      .createQueryBuilder('branchProduct')
      .leftJoinAndSelect('branchProduct.branch', 'branch')
      .leftJoinAndSelect('branchProduct.product', 'product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.unit', 'unit')
      .where('branchProduct.low_stock_threshold > 0')
      .andWhere('branchProduct.stock_quantity < branchProduct.low_stock_threshold')
      .andWhere('branch.is_active = true')
      .orderBy('branchProduct.stock_quantity', 'ASC')
      .addOrderBy('branch.updated_at', 'DESC')
      .getMany();

    return lowStockRows.map((row) => this.toBranchProductView(row));
  }

  async initiateStockTransfer(
    stockTransferDto: StockTransferDto,
    initiatedBy: string,
  ): Promise<StockTransferEntity> {
    if (stockTransferDto.fromBranchId === stockTransferDto.toBranchId) {
      throw new BadRequestException(
        'fromBranchId and toBranchId must be different.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const fromBranch = await this.getBranchOrFail(
        stockTransferDto.fromBranchId,
        manager,
      );
      const toBranch = await this.getBranchOrFail(stockTransferDto.toBranchId, manager);

      if (!fromBranch.isActive || !toBranch.isActive) {
        throw new BadRequestException(
          'Stock transfer requires both source and destination branches to be active.',
        );
      }

      const product = await manager.findOne(Product, {
        where: { id: stockTransferDto.productId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) {
        throw new NotFoundException(
          `Product "${stockTransferDto.productId}" not found.`,
        );
      }

      await this.applyBranchStockDelta(
        manager,
        fromBranch.id,
        product,
        -stockTransferDto.quantity,
        'stock_transfer_out',
        false,
      );
      await this.applyBranchStockDelta(
        manager,
        toBranch.id,
        product,
        stockTransferDto.quantity,
        'stock_transfer_in',
        false,
      );

      const transfer = manager.create(StockTransferEntity, {
        fromBranch,
        fromBranchId: fromBranch.id,
        toBranch,
        toBranchId: toBranch.id,
        product,
        productId: product.id,
        quantity: stockTransferDto.quantity,
        initiatedBy,
        status: StockTransferStatus.COMPLETED,
      });

      const saved = await manager.save(StockTransferEntity, transfer);
      const reloaded = await manager.findOne(StockTransferEntity, {
        where: { id: saved.id },
      });

      if (!reloaded) {
        throw new NotFoundException('Created stock transfer could not be loaded.');
      }

      return reloaded;
    });
  }

  async getStockTransferHistory(): Promise<StockTransferEntity[]> {
    return this.stockTransfersRepository.find({
      order: { timestamp: 'DESC' },
    });
  }

  async decreaseStockInBranch(
    manager: EntityManager,
    branchId: string,
    product: Product,
    quantity: number,
    source: string,
  ): Promise<void> {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0.');
    }

    await this.applyBranchStockDelta(
      manager,
      branchId,
      product,
      -quantity,
      source,
      true,
    );
  }

  async increaseStockInBranch(
    manager: EntityManager,
    branchId: string,
    product: Product,
    quantity: number,
    source: string,
  ): Promise<void> {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0.');
    }

    await this.applyBranchStockDelta(
      manager,
      branchId,
      product,
      quantity,
      source,
      true,
    );
  }

  async getBranchOrFail(
    branchId: string,
    manager?: EntityManager,
  ): Promise<BranchEntity> {
    const repository = manager
      ? manager.getRepository(BranchEntity)
      : this.branchesRepository;

    const branch = await repository.findOne({
      where: { id: branchId },
    });
    if (!branch) {
      throw new NotFoundException(`Branch "${branchId}" not found.`);
    }
    return branch;
  }

  private async applyBranchStockDelta(
    manager: EntityManager,
    branchId: string,
    product: Product,
    deltaQuantity: number,
    source: string,
    syncGlobalProductStock: boolean,
  ): Promise<void> {
    const branch = await this.getBranchOrFail(branchId, manager);
    if (!branch.isActive) {
      throw new BadRequestException(
        `Branch "${branch.name}" is inactive. Cannot adjust branch stock.`,
      );
    }

    let branchProduct = await manager.findOne(BranchProductEntity, {
      where: { branchId, productId: product.id },
      lock: { mode: 'pessimistic_write' },
      relations: { branch: true, product: true },
    });

    if (!branchProduct) {
      if (deltaQuantity < 0) {
        throw new BadRequestException(
          `Insufficient branch stock. Product "${product.name}" has no stock row in branch "${branch.name}".`,
        );
      }

      branchProduct = manager.create(BranchProductEntity, {
        branch,
        branchId: branch.id,
        product,
        productId: product.id,
        stockQuantity: 0,
        lowStockThreshold: product.lowStockThreshold ?? 0,
      });
    }

    const previousStockQuantity = branchProduct.stockQuantity;
    const nextStockQuantity = previousStockQuantity + deltaQuantity;
    if (nextStockQuantity < 0) {
      throw new BadRequestException(
        `Insufficient stock for "${product.name}" in branch "${branch.name}". Available: ${previousStockQuantity}, required: ${Math.abs(deltaQuantity)}.`,
      );
    }

    branchProduct.stockQuantity = nextStockQuantity;
    await manager.save(BranchProductEntity, branchProduct);

    if (syncGlobalProductStock && deltaQuantity !== 0) {
      product.stockQty += deltaQuantity;
      if (product.stockQty < 0) {
        throw new BadRequestException(
          `Global stock would become negative for product "${product.name}".`,
        );
      }
      await manager.save(Product, product);
    }

    this.logLowStockCrossing(branchProduct, previousStockQuantity, source);
  }

  private async ensureUniqueBranchCode(
    code: string,
    ignoreBranchId?: string,
  ): Promise<void> {
    const query = this.branchesRepository
      .createQueryBuilder('branch')
      .withDeleted()
      .where('LOWER(branch.code) = LOWER(:code)', { code });

    if (ignoreBranchId) {
      query.andWhere('branch.id <> :ignoreBranchId', { ignoreBranchId });
    }

    const duplicate = await query.getOne();
    if (duplicate) {
      throw new ConflictException(`Branch code "${code}" already exists.`);
    }
  }

  private toBranchProductView(branchProduct: BranchProductEntity): BranchProductView {
    const unitPrice = Number(branchProduct.product.price || 0);
    const stockValue = Number((unitPrice * branchProduct.stockQuantity).toFixed(2));
    const threshold = branchProduct.lowStockThreshold ?? 0;

    return {
      id: branchProduct.id,
      branchId: branchProduct.branchId,
      branchName: branchProduct.branch?.name ?? null,
      productId: branchProduct.productId,
      productName: branchProduct.product.name,
      sku: branchProduct.product.sku,
      stockQuantity: branchProduct.stockQuantity,
      lowStockThreshold: threshold,
      stockValue,
      isLowStock: threshold > 0 && branchProduct.stockQuantity < threshold,
      unitPrice,
      product: branchProduct.product,
    };
  }

  private logLowStockCrossing(
    branchProduct: BranchProductEntity,
    previousStockQuantity: number,
    source: string,
  ): void {
    const threshold = branchProduct.lowStockThreshold ?? 0;
    if (threshold <= 0) {
      return;
    }

    const crossedBelowThreshold =
      previousStockQuantity >= threshold &&
      branchProduct.stockQuantity < threshold;

    if (!crossedBelowThreshold) {
      return;
    }

    this.logger.warn(
      `LOW_STOCK_BRANCH_ALERT source=${source} branchId=${branchProduct.branchId} productId=${branchProduct.productId} stockQuantity=${branchProduct.stockQuantity} threshold=${threshold}`,
    );
  }
}
