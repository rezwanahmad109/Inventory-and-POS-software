import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  MoreThan,
  Repository,
} from 'typeorm';

import { BranchProductDto } from './dto/branch-product.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { InventoryCostingService } from '../common/services/inventory-costing.service';
import { QuickStockService } from './quick-stock.service';
import { StockTransferDto } from './dto/stock-transfer.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { TransactionRunnerService } from '../common/services/transaction-runner.service';
import { getBooleanConfig } from '../common/utils/config.util';
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

export interface WarehouseStockLevelView {
  branchId: string;
  branchName: string;
  productId: string;
  productName: string;
  sku: string;
  stockQuantity: number;
  lowStockThreshold: number;
  stockValue: number;
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
    private readonly configService: ConfigService,
    private readonly inventoryCostingService: InventoryCostingService,
    private readonly quickStockService: QuickStockService,
    private readonly transactionRunner: TransactionRunnerService,
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
    return this.transactionRunner.runInTransaction(async (manager) => {
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

      if (nextStockQuantity < 0 && !this.allowNegativeStock()) {
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
        if (product.stockQty < 0 && !this.allowNegativeStock()) {
          throw new BadRequestException(
            `Global stock would become negative for product "${product.name}".`,
          );
        }
        await manager.save(Product, product);
      }

      await manager.save(BranchProductEntity, branchProduct);
      this.quickStockService.invalidateLowStockCache();
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
    const lowStockRows =
      await this.quickStockService.getLowStockAcrossBranches();

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

    return this.transactionRunner.runInTransaction(async (manager) => {
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

      const transfer = manager.create(StockTransferEntity, {
        fromBranch,
        fromBranchId: fromBranch.id,
        toBranch,
        toBranchId: toBranch.id,
        product,
        productId: product.id,
        quantity: stockTransferDto.quantity,
        initiatedBy,
        status: StockTransferStatus.PENDING_APPROVAL,
        notes: stockTransferDto.notes?.trim() ?? null,
        approvedAt: null,
        approvedBy: null,
        receivedAt: null,
        receivedBy: null,
        cancelledAt: null,
        cancelledBy: null,
        costSnapshot: null,
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

  async approveStockTransfer(
    transferId: string,
    approvedBy: string,
    note?: string,
  ): Promise<StockTransferEntity> {
    return this.transactionRunner.runInTransaction(async (manager) => {
      const transfer = await manager.findOne(StockTransferEntity, {
        where: { id: transferId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!transfer) {
        throw new NotFoundException(`Stock transfer "${transferId}" not found.`);
      }
      if (transfer.status !== StockTransferStatus.PENDING_APPROVAL) {
        throw new BadRequestException(
          'Only pending stock transfers can be approved.',
        );
      }

      const product = await manager.findOne(Product, {
        where: { id: transfer.productId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) {
        throw new NotFoundException(`Product "${transfer.productId}" not found.`);
      }

      await this.applyBranchStockDelta(
        manager,
        transfer.fromBranchId,
        product,
        -transfer.quantity,
        'stock_transfer_approved',
        false,
      );
      const consumedLayers = await this.inventoryCostingService.consumeForTransfer(
        manager,
        {
          productId: transfer.productId,
          warehouseId: transfer.fromBranchId,
          quantity: transfer.quantity,
          referenceType: 'stock_transfer_out',
          referenceId: transfer.id,
          referenceLineId: null,
          actorId: approvedBy,
        },
      );
      transfer.costSnapshot = consumedLayers.layers.map((layer) => ({
        sourceLayerId: layer.sourceLayerId,
        quantity: layer.quantity,
        unitCost: layer.unitCost,
      }));

      transfer.status = StockTransferStatus.APPROVED;
      transfer.approvedBy = approvedBy;
      transfer.approvedAt = new Date();
      if (note !== undefined) {
        transfer.notes = note.trim() || transfer.notes;
      }

      return manager.save(StockTransferEntity, transfer);
    });
  }

  async receiveStockTransfer(
    transferId: string,
    receivedBy: string,
    note?: string,
  ): Promise<StockTransferEntity> {
    return this.transactionRunner.runInTransaction(async (manager) => {
      const transfer = await manager.findOne(StockTransferEntity, {
        where: { id: transferId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!transfer) {
        throw new NotFoundException(`Stock transfer "${transferId}" not found.`);
      }
      if (transfer.status !== StockTransferStatus.APPROVED) {
        throw new BadRequestException(
          'Only approved stock transfers can be received.',
        );
      }

      const product = await manager.findOne(Product, {
        where: { id: transfer.productId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) {
        throw new NotFoundException(`Product "${transfer.productId}" not found.`);
      }

      await this.applyBranchStockDelta(
        manager,
        transfer.toBranchId,
        product,
        transfer.quantity,
        'stock_transfer_received',
        false,
      );
      const snapshot =
        transfer.costSnapshot && transfer.costSnapshot.length > 0
          ? transfer.costSnapshot
          : [
              {
                sourceLayerId: null,
                quantity: transfer.quantity,
                unitCost: Number(product.price),
              },
            ];
      await this.inventoryCostingService.receiveTransfer(manager, {
        productId: transfer.productId,
        warehouseId: transfer.toBranchId,
        sourceId: transfer.id,
        snapshots: snapshot,
        actorId: receivedBy,
      });

      transfer.status = StockTransferStatus.RECEIVED;
      transfer.receivedBy = receivedBy;
      transfer.receivedAt = new Date();
      if (note !== undefined) {
        transfer.notes = note.trim() || transfer.notes;
      }

      return manager.save(StockTransferEntity, transfer);
    });
  }

  async getWarehouseStockLevels(
    branchId?: string,
  ): Promise<WarehouseStockLevelView[]> {
    const query = this.branchProductsRepository
      .createQueryBuilder('branchProduct')
      .leftJoin('branchProduct.branch', 'branch')
      .leftJoin('branchProduct.product', 'product')
      .select('branch.id', 'branchId')
      .addSelect('branch.name', 'branchName')
      .addSelect('product.id', 'productId')
      .addSelect('product.name', 'productName')
      .addSelect('product.sku', 'sku')
      .addSelect('branchProduct.stock_quantity', 'stockQuantity')
      .addSelect('branchProduct.low_stock_threshold', 'lowStockThreshold')
      .addSelect('(branchProduct.stock_quantity * product.price)', 'stockValue')
      .where('branch.is_active = true')
      .orderBy('branch.name', 'ASC')
      .addOrderBy('product.name', 'ASC');

    if (branchId) {
      query.andWhere('branch.id = :branchId', { branchId });
    }

    const rows = await query.getRawMany<{
      branchId: string;
      branchName: string;
      productId: string;
      productName: string;
      sku: string;
      stockQuantity: string;
      lowStockThreshold: string;
      stockValue: string;
    }>();

    return rows.map((row) => ({
      branchId: row.branchId,
      branchName: row.branchName,
      productId: row.productId,
      productName: row.productName,
      sku: row.sku,
      stockQuantity: Number(row.stockQuantity ?? 0),
      lowStockThreshold: Number(row.lowStockThreshold ?? 0),
      stockValue: Number(Number(row.stockValue ?? 0).toFixed(2)),
    }));
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
    if (nextStockQuantity < 0 && !this.allowNegativeStock()) {
      throw new BadRequestException(
        `Insufficient stock for "${product.name}" in branch "${branch.name}". Available: ${previousStockQuantity}, required: ${Math.abs(deltaQuantity)}.`,
      );
    }

    branchProduct.stockQuantity = nextStockQuantity;
    await manager.save(BranchProductEntity, branchProduct);
    this.quickStockService.invalidateLowStockCache();

    if (syncGlobalProductStock && deltaQuantity !== 0) {
      product.stockQty += deltaQuantity;
      if (product.stockQty < 0 && !this.allowNegativeStock()) {
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

  private allowNegativeStock(): boolean {
    return getBooleanConfig(
      this.configService.get('ALLOW_NEGATIVE_STOCK'),
      false,
    );
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
      isLowStock: this.quickStockService.isLowStock(
        branchProduct.stockQuantity,
        threshold,
      ),
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

    const crossedBelowThreshold = this.quickStockService.crossedIntoLowStock(
      previousStockQuantity,
      branchProduct.stockQuantity,
      threshold,
    );

    if (!crossedBelowThreshold) {
      return;
    }

    this.logger.warn(
      `LOW_STOCK_BRANCH_ALERT source=${source} branchId=${branchProduct.branchId} productId=${branchProduct.productId} stockQuantity=${branchProduct.stockQuantity} threshold=${threshold}`,
    );
  }
}

