import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';

import { Category, Product, Unit } from '../database/entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

export type ProductView = Product & {
  stockValue: number;
  isLowStock: boolean;
};

export interface ProductFilters {
  categoryId?: string;
  unitId?: string;
}

export interface ProductSearchResult extends ProductView {
  matchRank: number;
  hotScore: number;
}

type HotProductCacheEntry = {
  score: number;
  lastTouchedAt: number;
};

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private readonly hotProductCache = new Map<string, HotProductCacheEntry>();
  private readonly hotCacheMaxEntries = 300;

  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Unit)
    private readonly unitsRepository: Repository<Unit>,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<ProductView> {
    const sku = createProductDto.sku.trim();
    const barcode = this.normalizeBarcode(createProductDto.barcode);

    await this.ensureUniqueSku(sku);
    await this.ensureUniqueBarcode(barcode);

    const category = await this.getCategoryOrFail(createProductDto.categoryId);
    const unit = await this.getUnitOrFail(createProductDto.unitId);

    const product = this.productsRepository.create({
      sku,
      barcode,
      name: createProductDto.name.trim(),
      category,
      categoryId: category.id,
      unit,
      unitId: unit.id,
      price: createProductDto.price,
      taxRate: createProductDto.taxRate ?? null,
      taxMethod: createProductDto.taxMethod,
      stockQty: createProductDto.stockQty,
      lowStockThreshold: createProductDto.lowStockThreshold ?? 0,
      description: createProductDto.description?.trim() ?? null,
      image: createProductDto.image?.trim() ?? null,
    });

    const saved = await this.productsRepository.save(product);
    return this.findOne(saved.id);
  }

  async findAll(filters: ProductFilters = {}): Promise<ProductView[]> {
    const products = await this.buildProductQuery(filters)
      .orderBy('product.createdAt', 'DESC')
      .getMany();

    return products.map((product) => this.toProductView(product));
  }

  async findOne(id: string): Promise<ProductView> {
    const product = await this.findOneEntityOrFail(id);
    return this.toProductView(product);
  }

  async findByBarcode(barcode: string): Promise<ProductView> {
    const normalizedBarcode = barcode.trim();
    if (!normalizedBarcode) {
      throw new NotFoundException('Barcode is required.');
    }

    const product = await this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.unit', 'unit')
      .where('LOWER(product.barcode) = LOWER(:barcode)', { barcode: normalizedBarcode })
      .getOne();

    if (!product) {
      throw new NotFoundException(`Product with barcode "${barcode}" not found.`);
    }

    this.markHotItem(product.id);
    return this.toProductView(product);
  }

  async search(query: string, limit = 20): Promise<ProductSearchResult[]> {
    const q = query.trim();
    if (!q) {
      const hotIds = [...this.hotProductCache.entries()]
        .sort(([, a], [, b]) => b.score - a.score)
        .slice(0, Math.min(limit, 25))
        .map(([id]) => id);

      if (hotIds.length === 0) {
        return [];
      }

      const hotProducts = await this.productsRepository.find({
        where: { id: In(hotIds) },
        relations: {
          category: true,
          unit: true,
        },
      });

      return hotProducts
        .map((product) => ({
          ...this.toProductView(product),
          matchRank: 0,
          hotScore: this.getHotScore(product.id),
        }))
        .sort((a, b) => b.hotScore - a.hotScore);
    }

    const safeLimit = Math.max(1, Math.min(limit, 50));
    const exact = q.toLowerCase();
    const prefix = `${exact}%`;
    const like = `%${exact}%`;

    const qb = this.buildProductQuery();
    qb
      .addSelect(
        `
        CASE
          WHEN LOWER(COALESCE(product.barcode, '')) = :exact THEN 120
          WHEN LOWER(product.sku) = :exact THEN 110
          WHEN LOWER(product.sku) LIKE :prefix THEN 100
          WHEN LOWER(COALESCE(product.barcode, '')) LIKE :prefix THEN 95
          WHEN LOWER(product.name) LIKE :prefix THEN 85
          WHEN LOWER(product.name) LIKE :like THEN 75
          ELSE 60
        END
        `,
        'match_rank',
      )
      .where(
        `(
          LOWER(product.sku) LIKE :like
          OR LOWER(COALESCE(product.barcode, '')) LIKE :like
          OR LOWER(product.name) LIKE :like
        )`,
        { like, prefix, exact },
      )
      .orderBy('match_rank', 'DESC')
      .addOrderBy('product.updatedAt', 'DESC')
      .limit(safeLimit);

    const { entities, raw } = await qb.getRawAndEntities();

    const rankedResults = entities.map((product, index) => {
      const rank = Number(raw[index]?.match_rank ?? 0);
      return {
        ...this.toProductView(product),
        matchRank: rank,
        hotScore: this.getHotScore(product.id),
      } satisfies ProductSearchResult;
    });

    rankedResults.sort((a, b) => {
      if (b.matchRank !== a.matchRank) {
        return b.matchRank - a.matchRank;
      }
      if (b.hotScore !== a.hotScore) {
        return b.hotScore - a.hotScore;
      }
      return a.name.localeCompare(b.name);
    });

    for (const result of rankedResults) {
      this.markHotItem(result.id);
    }

    return rankedResults;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<ProductView> {
    const product = await this.findOneEntityOrFail(id);
    const previousStockQty = product.stockQty;

    if (updateProductDto.sku !== undefined) {
      const nextSku = updateProductDto.sku.trim();
      if (nextSku !== product.sku) {
        await this.ensureUniqueSku(nextSku, product.id);
      }
      product.sku = nextSku;
    }

    if (updateProductDto.barcode !== undefined) {
      const barcode = this.normalizeBarcode(updateProductDto.barcode);
      if (barcode !== product.barcode) {
        await this.ensureUniqueBarcode(barcode, product.id);
      }
      product.barcode = barcode;
    }

    if (updateProductDto.categoryId !== undefined) {
      const category = await this.getCategoryOrFail(updateProductDto.categoryId);
      product.category = category;
      product.categoryId = category.id;
    }

    if (updateProductDto.unitId !== undefined) {
      const unit = await this.getUnitOrFail(updateProductDto.unitId);
      product.unit = unit;
      product.unitId = unit.id;
    }

    if (updateProductDto.name !== undefined) {
      product.name = updateProductDto.name.trim();
    }

    if (updateProductDto.price !== undefined) {
      product.price = updateProductDto.price;
    }

    if (updateProductDto.taxRate !== undefined) {
      product.taxRate = updateProductDto.taxRate;
    }

    if (updateProductDto.taxMethod !== undefined) {
      product.taxMethod = updateProductDto.taxMethod;
    }

    if (updateProductDto.stockQty !== undefined) {
      product.stockQty = updateProductDto.stockQty;
    }

    if (updateProductDto.lowStockThreshold !== undefined) {
      product.lowStockThreshold = updateProductDto.lowStockThreshold;
    }

    if (updateProductDto.description !== undefined) {
      product.description = updateProductDto.description.trim() || null;
    }

    if (updateProductDto.image !== undefined) {
      product.image = updateProductDto.image.trim() || null;
    }

    const saved = await this.productsRepository.save(product);
    this.handleStockLevelChange(saved, previousStockQty, 'manual_update');
    return this.toProductView(saved);
  }

  async remove(id: string): Promise<void> {
    await this.findOneEntityOrFail(id);
    await this.productsRepository.softDelete(id);
  }

  async findLowStockProducts(): Promise<ProductView[]> {
    const products = await this.buildProductQuery()
      .where('product.lowStockThreshold > 0')
      .andWhere('product.stockQty <= product.lowStockThreshold')
      .orderBy('product.stockQty', 'ASC')
      .addOrderBy('product.createdAt', 'DESC')
      .getMany();

    return products.map((product) => this.toProductView(product));
  }

  markHotItem(productId: string): void {
    const current = this.hotProductCache.get(productId);
    const now = Date.now();

    this.hotProductCache.set(productId, {
      score: (current?.score ?? 0) + 1,
      lastTouchedAt: now,
    });

    if (this.hotProductCache.size <= this.hotCacheMaxEntries) {
      return;
    }

    const sortedByOldest = [...this.hotProductCache.entries()].sort(
      ([, a], [, b]) => a.lastTouchedAt - b.lastTouchedAt,
    );

    while (sortedByOldest.length > 0 && this.hotProductCache.size > this.hotCacheMaxEntries) {
      const [oldestKey] = sortedByOldest.shift()!;
      this.hotProductCache.delete(oldestKey);
    }
  }

  convertQuantity(quantity: number, fromUnit: Unit, toUnit: Unit): number {
    const fromFactor = Number(fromUnit.conversionFactor || 1);
    const toFactor = Number(toUnit.conversionFactor || 1);
    const baseQuantity = quantity * fromFactor;
    return Number((baseQuantity / toFactor).toFixed(4));
  }

  handleStockLevelChange(
    product: Product,
    previousStockQty: number,
    source: string,
  ): void {
    const threshold = product.lowStockThreshold ?? 0;
    if (threshold <= 0) {
      return;
    }

    const crossedBelowThreshold =
      previousStockQty > threshold && product.stockQty <= threshold;
    if (!crossedBelowThreshold) {
      return;
    }

    this.logger.warn(
      `LOW_STOCK_ALERT source=${source} productId=${product.id} sku=${product.sku} stockQty=${product.stockQty} threshold=${threshold}`,
    );
  }

  private getHotScore(productId: string): number {
    return this.hotProductCache.get(productId)?.score ?? 0;
  }

  private normalizeBarcode(barcode?: string): string | null {
    if (barcode === undefined) {
      return null;
    }

    const trimmed = barcode.trim();
    return trimmed ? trimmed : null;
  }

  private async findOneEntityOrFail(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: { category: true, unit: true },
    });

    if (!product) {
      throw new NotFoundException(`Product "${id}" not found.`);
    }

    return product;
  }

  private buildProductQuery(filters: ProductFilters = {}): SelectQueryBuilder<Product> {
    const query = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.unit', 'unit');

    if (filters.categoryId) {
      query.andWhere('product.categoryId = :categoryId', {
        categoryId: filters.categoryId,
      });
    }

    if (filters.unitId) {
      query.andWhere('product.unitId = :unitId', {
        unitId: filters.unitId,
      });
    }

    return query;
  }

  private toProductView(product: Product): ProductView {
    const unitPrice = Number(product.price || 0);
    const stockValue = Number((product.stockQty * unitPrice).toFixed(2));
    const threshold = product.lowStockThreshold ?? 0;

    return {
      ...product,
      stockValue,
      isLowStock: threshold > 0 && product.stockQty <= threshold,
    };
  }

  private async getCategoryOrFail(categoryId: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException(`Category "${categoryId}" not found.`);
    }
    return category;
  }

  private async getUnitOrFail(unitId: string): Promise<Unit> {
    const unit = await this.unitsRepository.findOne({
      where: { id: unitId },
    });
    if (!unit) {
      throw new NotFoundException(`Unit "${unitId}" not found.`);
    }
    return unit;
  }

  private async ensureUniqueSku(sku: string, ignoreProductId?: string): Promise<void> {
    const query = this.productsRepository
      .createQueryBuilder('product')
      .withDeleted()
      .where('LOWER(product.sku) = LOWER(:sku)', { sku });

    if (ignoreProductId) {
      query.andWhere('product.id <> :ignoreProductId', { ignoreProductId });
    }

    const duplicate = await query.getOne();
    if (!duplicate) {
      return;
    }

    throw new ConflictException(`SKU "${sku}" already exists.`);
  }

  private async ensureUniqueBarcode(
    barcode: string | null,
    ignoreProductId?: string,
  ): Promise<void> {
    if (!barcode) {
      return;
    }

    const query = this.productsRepository
      .createQueryBuilder('product')
      .withDeleted()
      .where('LOWER(product.barcode) = LOWER(:barcode)', { barcode });

    if (ignoreProductId) {
      query.andWhere('product.id <> :ignoreProductId', { ignoreProductId });
    }

    const duplicate = await query.getOne();
    if (!duplicate) {
      return;
    }

    throw new ConflictException(`Barcode "${barcode}" already exists.`);
  }
}
